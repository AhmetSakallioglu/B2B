import { detectImageSignature, type VerifiedImageType } from "@/lib/file-signatures";
import {
  isRemoteStorageUrl,
  resolveLocalStoredPath,
  saveStoredFile,
  storedUrlUsesPrefix,
} from "@/lib/object-storage";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

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

export async function saveCompanyLogo(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Logo must be 2 MB or smaller");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageSignature(buffer);

  if (!detectedType || detectedType === "webp") {
    throw new Error("Invalid logo format. Use JPG or PNG.");
  }

  return saveStoredFile({
    category: "company-logos",
    buffer,
    extension: extensionForType(detectedType),
  });
}

export function resolveCompanyLogoPath(storedUrl: string | null | undefined) {
  return resolveLocalStoredPath(storedUrl);
}

export function isLocalCompanyLogo(imageUrl: string | null | undefined) {
  return storedUrlUsesPrefix(imageUrl, "company-logos") || isRemoteStorageUrl(imageUrl);
}
