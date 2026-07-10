import {
  deleteStoredFile,
  isRemoteStorageUrl,
  saveStoredFile,
  storedUrlUsesPrefix,
} from "@/lib/object-storage";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_PDF_SIZE = 15 * 1024 * 1024;
const ANNOUNCEMENT_UPLOAD_PREFIX = "/uploads/announcements/";

type DetectedMediaType = "jpeg" | "png" | "pdf";

function detectMediaType(buffer: Buffer): DetectedMediaType | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") {
    return "pdf";
  }

  return null;
}

function extensionForType(type: DetectedMediaType) {
  switch (type) {
    case "png":
      return "png";
    case "pdf":
      return "pdf";
    default:
      return "jpg";
  }
}

export function isLocalAnnouncementMediaUrl(url: string | null | undefined) {
  return (
    Boolean(url?.startsWith(ANNOUNCEMENT_UPLOAD_PREFIX)) ||
    storedUrlUsesPrefix(url, "announcements") ||
    isRemoteStorageUrl(url)
  );
}

export function inferAnnouncementMediaType(
  mediaUrl: string | null | undefined
): "image" | "pdf" | null {
  if (!mediaUrl) {
    return null;
  }

  const lower = mediaUrl.toLowerCase();

  if (lower.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png")
  ) {
    return "image";
  }

  return null;
}

export async function saveAnnouncementMedia(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectMediaType(buffer);

  if (!detectedType) {
    throw new Error("Only JPG, PNG, or PDF files are allowed");
  }

  const maxSize = detectedType === "pdf" ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    throw new Error(
      detectedType === "pdf"
        ? "PDF must be 15 MB or smaller"
        : "Image must be 8 MB or smaller"
    );
  }

  return saveStoredFile({
    category: "announcements",
    buffer,
    extension: extensionForType(detectedType),
  });
}

export async function deleteAnnouncementMedia(mediaUrl: string | null | undefined) {
  await deleteStoredFile(mediaUrl);
}
