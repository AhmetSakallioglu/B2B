import {
  assertExtensionMatchesDocumentSignature,
  type VerifiedDocumentType,
} from "@/lib/file-signatures";
import {
  isRemoteStorageUrl,
  resolveLocalStoredPath,
  saveStoredFile,
  storedUrlUsesPrefix,
} from "@/lib/object-storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["jpeg", "jpg", "png", "pdf", "doc", "docx"]);

function extensionFromFilename(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

function storedExtension(type: VerifiedDocumentType) {
  if (type === "jpeg") {
    return "jpg";
  }

  return type;
}

export function resolveTaxDocumentPath(storedUrl: string) {
  return resolveLocalStoredPath(storedUrl);
}

export async function saveTaxDocument(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Tax document must be 10 MB or smaller");
  }

  const extension = extensionFromFilename(file.name);

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Allowed formats: jpeg, jpg, png, pdf, doc, docx");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = assertExtensionMatchesDocumentSignature(buffer, extension);

  return saveStoredFile({
    category: "tax-documents",
    buffer,
    extension: storedExtension(detectedType),
  });
}

export function isRemoteTaxDocumentUrl(storedUrl: string | null | undefined) {
  return storedUrlUsesPrefix(storedUrl, "tax-documents") || isRemoteStorageUrl(storedUrl);
}
