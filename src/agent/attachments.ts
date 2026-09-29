import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { config } from "../config";
import type { Attachment } from "./store";

// Documents the user attaches to a message: PDFs, spreadsheets saved as CSV,
// and text files. A text file is read on the device; a PDF is sent to the
// site, which reads its text and keeps nothing. Either way the agent gets
// the text as data, never the file. Photos are not offered for now.
export type PendingAttachment = Attachment & {
  text?: string;
  /** Set by older builds for photos; nothing attaches one now. */
  dataUrl?: string;
};

/** What the picker offers. Android reports CSV under several types. */
const PICKABLE = [
  "application/pdf",
  "text/*",
  "text/csv",
  "text/comma-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
  "application/json",
  "application/xml",
  "application/x-yaml",
];
const TEXT_TYPES = /^(text\/|application\/(json|xml|csv|x-yaml|yaml|javascript|x-ndjson))/;
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|ndjson|xml|yaml|yml|log|html?|toml|ini)$/i;
const MAX_PDF_BYTES = 4 * 1024 * 1024;
/** How much of a document the agent reads; the rest is left out and said so. */
export const MAX_TEXT = 12000;

/** Why a picked file cannot be attached, in words for the user. */
export class AttachmentError extends Error {}

async function readPdf(asset: DocumentPicker.DocumentPickerAsset, token: string | null): Promise<string> {
  if (asset.size && asset.size > MAX_PDF_BYTES) throw new AttachmentError("That PDF is larger than 4 MB.");
  const form = new FormData();
  const webFile = (asset as { file?: Blob }).file;
  if (Platform.OS === "web" && webFile) form.append("file", webFile, asset.name);
  // React Native's FormData uploads a file from its URI.
  else form.append("file", { uri: asset.uri, name: asset.name, type: "application/pdf" } as unknown as Blob);
  const response = await fetch(`${config.apiUrl}/api/agent/document`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok || typeof body.text !== "string") throw new AttachmentError(body.error || "That PDF could not be read.");
  return body.text;
}

/**
 * Lets the user pick a document and reads it. A PDF needs the user's token
 * for the site; a text file does not.
 */
export async function pickDocument(token: () => Promise<string | null>): Promise<PendingAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: PICKABLE, multiple: false, copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const base: PendingAttachment = {
    kind: "text",
    name: asset.name,
    uri: asset.uri,
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
    ...(asset.size ? { size: asset.size } : {}),
  };
  if (asset.mimeType === "application/pdf" || /\.pdf$/i.test(asset.name)) {
    return { ...base, text: await readPdf(asset, await token()) };
  }
  const textual = (asset.mimeType && TEXT_TYPES.test(asset.mimeType)) || TEXT_EXTENSIONS.test(asset.name);
  if (!textual) throw new AttachmentError("The agent reads PDF, CSV and text files.");
  const webFile = (asset as { file?: { text(): Promise<string> } }).file;
  const text = Platform.OS === "web" ? await webFile?.text() : await new File(asset.uri).text();
  if (text === undefined) throw new AttachmentError("That file could not be read.");
  return { ...base, text };
}

/** What the agent is told about a message's attachments. */
export function attachmentContext(attachments: readonly PendingAttachment[]): string[] {
  return attachments.map((a) => {
    if (a.text !== undefined) {
      const cut = a.text.length > MAX_TEXT;
      return `attached document "${a.name}"${cut ? ` (first ${MAX_TEXT} characters of ${a.text.length})` : ""}:\n${a.text.slice(0, MAX_TEXT)}`;
    }
    return `attached file "${a.name}": you cannot read it; say so in one sentence.`;
  });
}

/** Only what is worth keeping with the message; document text is not stored twice. */
export const storedAttachment = ({ text: _text, dataUrl: _dataUrl, ...rest }: PendingAttachment): Attachment => rest;
