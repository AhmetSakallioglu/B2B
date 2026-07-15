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

function dedupePreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const url of urls) {
    if (seen.has(url)) {
      continue;
    }

    seen.add(url);
    unique.push(url);
  }

  return unique;
}

/** Merge variant override → product → shared finish gallery, with deduplication. */
export function mergeGalleryImages(sources: GallerySources): string[] {
  const combined = [
    ...normalizeUrls(sources.variantImages ?? []),
    ...normalizeUrls(sources.productImages),
    ...normalizeUrls(sources.finishImages),
  ];

  return dedupePreserveOrder(combined);
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
