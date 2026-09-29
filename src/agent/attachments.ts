import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { Attachment } from "./store";

// Photos and files the user attaches to a message. Text documents are read
// on the device and handed to the agent as data. A photo is shrunk to at
// most 1280 px on its long side as a JPEG and sent inline with the message,
// which is what Ryvo can price before the reply (and keeps the request
// small); other files are shown in the conversation and the agent is told
// they are there.
export type PendingAttachment = Attachment & {
  text?: string;
  /** The photo as the model sees it: a JPEG data: URL. Not stored with the message. */
  dataUrl?: string;
};

const MAX_IMAGE_SIDE = 1280;

/** A photo as a JPEG data: URL no larger than MAX_IMAGE_SIDE on its long side. */
export async function imageForModel(uri: string, width?: number, height?: number): Promise<string> {
  let w = width;
  let h = height;
  if (!w || !h) {
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    w = probe.width;
    h = probe.height;
  }
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(w, h) > MAX_IMAGE_SIDE) context.resize(w >= h ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error("The photo could not be prepared.");
  return `data:image/jpeg;base64,${saved.base64}`;
}

async function withModelImage(attachment: PendingAttachment, width?: number, height?: number): Promise<PendingAttachment> {
  if (!attachment.uri) return attachment;
  try {
    return { ...attachment, dataUrl: await imageForModel(attachment.uri, width, height) };
  } catch {
    return attachment;
  }
}

const TEXT_TYPES = /^(text\/|application\/(json|xml|csv|x-yaml|yaml|javascript|x-ndjson))/;
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|ndjson|xml|yaml|yml|log|html?|js|ts|py|sol|rs|toml|ini)$/i;
/** How much of a document the agent reads; the rest is left out and said so. */
export const MAX_TEXT = 12000;

export async function pickImage(): Promise<PendingAttachment | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return withModelImage(
    {
      kind: "image",
      name: asset.fileName || "Photo",
      uri: asset.uri,
      ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
      ...(asset.fileSize ? { size: asset.fileSize } : {}),
    },
    asset.width,
    asset.height,
  );
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
  if (asset.mimeType?.startsWith("image/")) return withModelImage({ ...base, kind: "image" });
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
      return a.dataUrl
        ? `attached image "${a.name}": it is included with this message; look at it to answer.`
        : `attached image "${a.name}": it could not be prepared, so you cannot see it; say so in one sentence.`;
    return `attached file "${a.name}"${a.mimeType ? ` (${a.mimeType})` : ""}: you cannot read this file type yet.`;
  });
}

/** Only what is worth keeping with the message; document text is not stored twice. */
export const storedAttachment = ({ text: _text, dataUrl: _dataUrl, ...rest }: PendingAttachment): Attachment => rest;
