import { filterAllowedImageUrls, isAllowedImageUrl } from "@/lib/safe-image-url";

export function buildVariantSku(
  productSku: string,
  finishName: string,
  widthIn: number,
  heightIn: number,
  depthIn: number
) {
  const colorCode = finishName
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return `${productSku}-${colorCode}-${widthIn}-${heightIn}-${depthIn}`;
}

export function parseCreateProductBody(body: unknown) {
  const fields = parseProductFields(body);

  if (!fields) {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const productImages = filterAllowedImageUrls(parseImageUrls(candidate));
  const coverCandidate =
    typeof candidate.coverImageUrl === "string" && candidate.coverImageUrl.trim()
      ? candidate.coverImageUrl.trim()
      : productImages[0] ?? null;
  const coverImageUrl =
    coverCandidate && isAllowedImageUrl(coverCandidate) ? coverCandidate : productImages[0] ?? null;

  return {
    ...fields,
    imageUrl: coverImageUrl,
    productImages,
  };
}

function parseImageUrls(candidate: Record<string, unknown>) {
  if (Array.isArray(candidate.productImages)) {
    return filterAllowedImageUrls(
      candidate.productImages
        .filter((url): url is string => typeof url === "string" && url.trim() !== "")
        .map((url) => url.trim())
    );
  }

  if (Array.isArray(candidate.imageUrls)) {
    return filterAllowedImageUrls(
      candidate.imageUrls
        .filter((url): url is string => typeof url === "string" && url.trim() !== "")
        .map((url) => url.trim())
    );
  }

  if (typeof candidate.imageUrl === "string" && candidate.imageUrl.trim()) {
    return filterAllowedImageUrls([candidate.imageUrl.trim()]);
  }

  return [];
}

export function parseUpdateProductBody(body: unknown) {
  const fields = parseProductFields(body);

  if (!fields) {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  let imageUrl: string | null | undefined = undefined;

  if ("imageUrl" in candidate) {
    if (typeof candidate.imageUrl !== "string" || !candidate.imageUrl.trim()) {
      imageUrl = null;
    } else {
      imageUrl = isAllowedImageUrl(candidate.imageUrl.trim())
        ? candidate.imageUrl.trim()
        : null;
    }
  }

  return {
    ...fields,
    imageUrl,
  };
}

export function parseFinishIds(body: Record<string, unknown>): number[] | null {
  if (Array.isArray(body.finishIds)) {
    const ids = body.finishIds.filter(
      (id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0
    );

    if (ids.length === 0) {
      return null;
    }

    return [...new Set(ids)].sort((a, b) => a - b);
  }

  if (
    typeof body.finishId === "number" &&
    Number.isInteger(body.finishId) &&
    body.finishId > 0
  ) {
    return [body.finishId];
  }

  return null;
}

function parseFinishPrices(
  candidate: Record<string, unknown>,
  finishIds: number[]
): Record<number, number> | null {
  if (!Array.isArray(candidate.finishPrices)) {
    return null;
  }

  const prices: Record<number, number> = {};

  for (const item of candidate.finishPrices) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const row = item as Record<string, unknown>;
    const finishId = Number(row.finishId);
    const price = Number(row.price);

    if (!Number.isInteger(finishId) || finishId <= 0 || !Number.isFinite(price) || price < 0) {
      return null;
    }

    prices[finishId] = price;
  }

  for (const finishId of finishIds) {
    if (!(finishId in prices)) {
      return null;
    }
  }

  return prices;
}

function parseProductFields(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  const requiredStrings = [
    "categorySlug",
    "subCategorySlug",
    "productSku",
    "productName",
    "description",
    "stockStatus",
  ] as const;

  for (const key of requiredStrings) {
    if (typeof candidate[key] !== "string" || candidate[key] === "") {
      return null;
    }
  }

  const finishIds = parseFinishIds(candidate);

  if (!finishIds) {
    return null;
  }

  const numericFields = ["widthIn", "heightIn", "depthIn"] as const;

  for (const key of numericFields) {
    if (typeof candidate[key] !== "number" || !Number.isFinite(candidate[key])) {
      return null;
    }
  }

  const finishPrices = parseFinishPrices(candidate, finishIds);
  const hasSinglePrice =
    typeof candidate.price === "number" && Number.isFinite(candidate.price) && candidate.price >= 0;

  if (finishIds.length > 1) {
    if (!finishPrices && !hasSinglePrice) {
      return null;
    }
  } else if (!hasSinglePrice) {
    return null;
  }

  const defaultPrice = hasSinglePrice ? (candidate.price as number) : 0;
  const resolvedFinishPrices = finishIds.reduce<Record<number, number>>((accumulator, finishId) => {
    accumulator[finishId] = finishPrices?.[finishId] ?? defaultPrice;
    return accumulator;
  }, {});

  if (
    candidate.stockStatus !== "in_stock" &&
    candidate.stockStatus !== "out_of_stock"
  ) {
    return null;
  }

  const widthIn = candidate.widthIn as number;
  const heightIn = candidate.heightIn as number;
  const depthIn = candidate.depthIn as number;
  const price = resolvedFinishPrices[finishIds[0]] ?? defaultPrice;

  if (widthIn <= 0 || heightIn <= 0 || depthIn <= 0) {
    return null;
  }

  const productSku = (candidate.productSku as string).trim().toUpperCase();
  const finishName =
    typeof candidate.finishName === "string" ? candidate.finishName.trim() : "";
  const useCustomVariantSku =
    finishIds.length === 1 &&
    typeof candidate.variantSku === "string" &&
    candidate.variantSku.trim();

  return {
    categorySlug: (candidate.categorySlug as string).trim(),
    subCategorySlug: (candidate.subCategorySlug as string).trim(),
    productSku,
    productName: (candidate.productName as string).trim(),
    description: (candidate.description as string).trim(),
    finishIds,
    finishName,
    widthIn,
    heightIn,
    depthIn,
    stockStatus: candidate.stockStatus as "in_stock" | "out_of_stock",
    price,
    finishPrices: resolvedFinishPrices,
    variantSku: useCustomVariantSku
      ? (candidate.variantSku as string).trim().toUpperCase()
      : finishName
        ? buildVariantSku(productSku, finishName, widthIn, heightIn, depthIn)
        : "",
  };
}
