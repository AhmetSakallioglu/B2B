import { detectImageSignature, type VerifiedImageType } from "@/lib/file-signatures";
import {
  isRemoteStorageUrl,
  saveStoredFile,
  storedUrlUsesPrefix,
} from "@/lib/object-storage";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function extensionForType(type: VerifiedImageType) {
  switch (type) {
    case "png":
      return "png";
    case "webp":
      return "webp";
    default:
      return "jpg";
  }
}

export async function saveProductImage(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image must be 5 MB or smaller");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageSignature(buffer);

  if (!detectedType) {
    throw new Error("Invalid file format signature");
  }

  return saveStoredFile({
    category: "products",
    buffer,
    extension: extensionForType(detectedType),
  });
}

export function isLocalProductImage(imageUrl: string | null | undefined) {
  return storedUrlUsesPrefix(imageUrl, "products") || isRemoteStorageUrl(imageUrl);
}
