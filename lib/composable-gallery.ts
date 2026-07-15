import { filterAllowedImageUrls } from "@/lib/safe-image-url";

export type GallerySources = {
  productImages: readonly string[];
  finishImages: readonly string[];
  variantImages?: readonly string[] | null;
  legacyImageUrl?: string | null;
};

function normalizeUrls(urls: readonly string[]): string[] {
  return filterAllowedImageUrls(
    urls.filter((url): url is string => typeof url === "string" && url.trim() !== "")
  );
}

/** Merge variant override → product → shared finish gallery, with deduplication. */
export function mergeGalleryImages(sources: GallerySources): string[] {
  const combined = [
    ...normalizeUrls(sources.variantImages ?? []),
    ...normalizeUrls(sources.productImages),
    ...normalizeUrls(sources.finishImages),
  ];

  return Array.from(new Set(combined));
}

export function galleryCoverUrl(sources: GallerySources): string {
  const merged = mergeGalleryImages(sources);

  if (merged.length > 0) {
    return merged[0];
  }

  const legacy = sources.legacyImageUrl?.trim();

  return legacy && legacy.length > 0 ? legacy : "";
}

export function parsePostgresTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}
