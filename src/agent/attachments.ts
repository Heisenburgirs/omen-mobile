import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import type { Attachment } from "./store";

// Photos and files the user attaches to a message. Text documents are read
// on the device and handed to the agent as data; images and other files are
// shown in the conversation, and the agent is told they are there. Ryvo does
// not accept image inputs on its payment rails yet, so no model can look at
// a photo until it does.
export type PendingAttachment = Attachment & { text?: string };

const TEXT_TYPES = /^(text\/|application\/(json|xml|csv|x-yaml|yaml|javascript|x-ndjson))/;
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|ndjson|xml|yaml|yml|log|html?|js|ts|py|sol|rs|toml|ini)$/i;
/** How much of a document the agent reads; the rest is left out and said so. */
export const MAX_TEXT = 12000;

export async function pickImage(): Promise<PendingAttachment | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    kind: "image",
    name: asset.fileName || "Photo",
    uri: asset.uri,
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
    ...(asset.fileSize ? { size: asset.fileSize } : {}),
  };
}

export async function pickFile(): Promise<PendingAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const base: PendingAttachment = {
    kind: "file",
    name: asset.name,
    uri: asset.uri,
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
    ...(asset.size ? { size: asset.size } : {}),
  };
  if (asset.mimeType?.startsWith("image/")) return { ...base, kind: "image" };
  const textual = (asset.mimeType && TEXT_TYPES.test(asset.mimeType)) || TEXT_EXTENSIONS.test(asset.name);
  if (!textual) return base;
  try {
    const text =
      Platform.OS === "web"
        ? await (asset as { file?: { text(): Promise<string> } }).file?.text()
        : await new File(asset.uri).text();
    return text === undefined ? base : { ...base, kind: "text", text };
  } catch {
    return base;
  }
}

/** What the agent is told about a message's attachments. */
export function attachmentContext(attachments: readonly PendingAttachment[]): string[] {
  return attachments.map((a) => {
    if (a.kind === "text" && a.text !== undefined) {
      const cut = a.text.length > MAX_TEXT;
      return `attached document "${a.name}"${cut ? ` (first ${MAX_TEXT} characters of ${a.text.length})` : ""}:\n${a.text.slice(0, MAX_TEXT)}`;
    }
    if (a.kind === "image")
      return `attached image "${a.name}": you cannot see images yet; if the user asks about it, say so in one sentence.`;
    return `attached file "${a.name}"${a.mimeType ? ` (${a.mimeType})` : ""}: you cannot read this file type yet.`;
  });
}

/** Only what is worth keeping with the message; document text is not stored twice. */
export const storedAttachment = ({ text: _text, ...rest }: PendingAttachment): Attachment => rest;
