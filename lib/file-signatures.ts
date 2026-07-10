export const INVALID_FILE_SIGNATURE_MESSAGE = "Invalid file format signature";

export type VerifiedImageType = "jpeg" | "png" | "webp";
export type VerifiedDocumentType = "jpeg" | "png" | "pdf" | "doc" | "docx";

export function hasPdfSignature(buffer: Buffer) {
  return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF";
}

export function hasJpegSignature(buffer: Buffer) {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

export function hasPngSignature(buffer: Buffer) {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

export function hasWebpSignature(buffer: Buffer) {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

export function detectImageSignature(buffer: Buffer): VerifiedImageType | null {
  if (hasJpegSignature(buffer)) {
    return "jpeg";
  }

  if (hasPngSignature(buffer)) {
    return "png";
  }

  if (hasWebpSignature(buffer)) {
    return "webp";
  }

  return null;
}

function detectOfficeSignature(buffer: Buffer, extension: string | null): "doc" | "docx" | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return extension === "docx" ? "docx" : "doc";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return extension === "doc" ? "doc" : "docx";
  }

  return null;
}

export function detectDocumentSignature(
  buffer: Buffer,
  extension: string | null
): VerifiedDocumentType | null {
  if (hasJpegSignature(buffer)) {
    return "jpeg";
  }

  if (hasPngSignature(buffer)) {
    return "png";
  }

  if (hasPdfSignature(buffer)) {
    return "pdf";
  }

  return detectOfficeSignature(buffer, extension);
}

export function assertExtensionMatchesDocumentSignature(
  buffer: Buffer,
  extension: string
) {
  const detected = detectDocumentSignature(buffer, extension);

  if (!detected) {
    throw new Error(INVALID_FILE_SIGNATURE_MESSAGE);
  }

  if ((extension === "jpg" || extension === "jpeg") && detected !== "jpeg") {
    throw new Error(INVALID_FILE_SIGNATURE_MESSAGE);
  }

  if (extension === "png" && detected !== "png") {
    throw new Error(INVALID_FILE_SIGNATURE_MESSAGE);
  }

  if (extension === "pdf" && detected !== "pdf") {
    throw new Error(INVALID_FILE_SIGNATURE_MESSAGE);
  }

  if (
    (extension === "doc" || extension === "docx") &&
    detected !== "doc" &&
    detected !== "docx"
  ) {
    throw new Error(INVALID_FILE_SIGNATURE_MESSAGE);
  }

  return detected;
}
