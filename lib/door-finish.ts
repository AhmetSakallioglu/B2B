import type { PoolClient } from "pg";
import { finishToSlug } from "@/lib/catalog-browse";
import { query } from "@/lib/db";
import { filterAllowedImageUrls, isAllowedImageUrl } from "@/lib/safe-image-url";
import type { DoorFinish } from "@/types/catalog";
import type {
  AdminDoorFinish,
  DoorFinishRow,
  UpdateDoorFinishBody,
  UpsertDoorFinishBody,
} from "@/types/door-finish";

export function mapDoorFinishRow(row: DoorFinishRow): AdminDoorFinish {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    sampleImage: row.finish_images?.[0] ?? row.sample_image_url ?? "",
    finishImages: row.finish_images ?? [],
    sortOrder: row.sort_order,
    isActive: row.is_active,
    variantCount: row.variant_count
      ? Number.parseInt(row.variant_count, 10)
      : 0,
    cartItemsCount: row.cart_items_count
      ? Number.parseInt(row.cart_items_count, 10)
      : 0,
  };
}

export function mapPublicDoorFinish(row: DoorFinishRow): DoorFinish {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sampleImage: row.finish_images?.[0] ?? row.sample_image_url ?? "",
    finishImages: row.finish_images ?? [],
    variantCount: row.variant_count
      ? Number.parseInt(row.variant_count, 10)
      : 0,
  };
}

export function parseUpsertDoorFinishBody(body: unknown): UpsertDoorFinishBody | null {
  const parsed = parseDoorFinishFields(body);

  if (!parsed || hasInvalidSampleImageUrl(body) || hasInvalidFinishImages(body)) {
    return null;
  }

  return {
    ...parsed,
    sampleImageUrl: parseSampleImageUrl(body),
    finishImages: parseFinishImagesArray(body),
  };
}

export function parseUpdateDoorFinishBody(body: unknown): UpdateDoorFinishBody | null {
  const parsed = parseDoorFinishFields(body);

  if (!parsed || hasInvalidSampleImageUrl(body) || hasInvalidFinishImages(body)) {
    return null;
  }

  if (!body || typeof body !== "object") {
    return parsed;
  }

  const candidate = body as Record<string, unknown>;
  const result: UpdateDoorFinishBody = { ...parsed };

  if ("sampleImageUrl" in candidate) {
    result.sampleImageUrl = parseSampleImageUrl(body);
  }

  if ("finishImages" in candidate) {
    result.finishImages = parseFinishImagesArray(body) ?? [];
  }

  return result;
}

function parseFinishImagesArray(body: unknown): string[] | undefined {
  if (!body || typeof body !== "object" || !("finishImages" in body)) {
    return undefined;
  }

  const candidate = body as Record<string, unknown>;

  if (!Array.isArray(candidate.finishImages)) {
    return undefined;
  }

  return filterAllowedImageUrls(
    candidate.finishImages
      .filter((url): url is string => typeof url === "string" && url.trim() !== "")
      .map((url) => url.trim())
  );
}

function hasInvalidFinishImages(body: unknown) {
  if (!body || typeof body !== "object" || !("finishImages" in body)) {
    return false;
  }

  const candidate = body as Record<string, unknown>;

  if (!Array.isArray(candidate.finishImages)) {
    return true;
  }

  return candidate.finishImages.some(
    (url) => typeof url !== "string" || (url.trim() !== "" && !isAllowedImageUrl(url.trim()))
  );
}

function parseSampleImageUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.sampleImageUrl !== "string") {
    return null;
  }

  const trimmed = candidate.sampleImageUrl.trim();

  if (!trimmed) {
    return null;
  }

  return isAllowedImageUrl(trimmed) ? trimmed : null;
}

function hasInvalidSampleImageUrl(body: unknown) {
  if (!body || typeof body !== "object") {
    return false;
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.sampleImageUrl !== "string") {
    return false;
  }

  const trimmed = candidate.sampleImageUrl.trim();

  return trimmed.length > 0 && !isAllowedImageUrl(trimmed);
}

function parseDoorFinishFields(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.name !== "string") {
    return null;
  }

  const name = candidate.name.trim();

  if (!name) {
    return null;
  }

  const slugSource =
    typeof candidate.slug === "string" && candidate.slug.trim()
      ? candidate.slug.trim()
      : name;
  const slug = finishToSlug(slugSource);

  if (!slug) {
    return null;
  }

  const sortOrder =
    typeof candidate.sortOrder === "number" && Number.isInteger(candidate.sortOrder)
      ? candidate.sortOrder
      : 0;

  return {
    name,
    slug,
    description:
      typeof candidate.description === "string" ? candidate.description.trim() : "",
    sortOrder,
    isActive: candidate.isActive !== false,
  };
}

export const DOOR_FINISH_SELECT = `
  df.id,
  df.name,
  df.slug,
  df.description,
  df.sample_image_url,
  df.finish_images,
  df.sort_order,
  df.is_active
`;

export async function syncVariantStockForFinishStatus(
  finishId: number,
  isActive: boolean,
  client?: Pick<PoolClient, "query">
) {
  const runQuery = client?.query.bind(client) ?? query;

  await runQuery(
    `
      UPDATE product_variants
      SET stock_status = $1
      WHERE finish_id = $2
    `,
    [isActive ? "in_stock" : "out_of_stock", finishId]
  );
}
