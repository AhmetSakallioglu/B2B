import { isAllowedRemoteImageHostname } from "@/lib/image-remote-config";

const MAX_IMAGE_URL_LENGTH = 2048;

export function isAllowedImageUrl(url: string): boolean {
  if (!url || url.length > MAX_IMAGE_URL_LENGTH) {
    return false;
  }

  if (url.includes("..") || url.includes("\\")) {
    return false;
  }

  if (url.startsWith("/uploads/products/")) {
    return /^\/uploads\/products\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/.test(url);
  }

  if (url.startsWith("/uploads/company-logos/")) {
    return /^\/uploads\/company-logos\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/.test(url);
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    return isAllowedRemoteImageHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export function filterAllowedImageUrls(urls: string[]): string[] {
  return urls.filter(isAllowedImageUrl);
}

export function parseAllowedImageUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return isAllowedImageUrl(trimmed) ? trimmed : null;
}
