import {
  galleryCoverUrl,
  mergeGalleryImages,
  parsePostgresTextArray,
  type GallerySources,
} from "@/lib/composable-gallery";
import { query } from "@/lib/db";

export type VariantGalleryContext = GallerySources & {
  variantId: number;
  productId: number;
  finishId: number;
};

type VariantGalleryRow = {
  variant_id: number;
  product_id: number;
  finish_id: number;
  product_images: string[] | null;
  finish_images: string[] | null;
  variant_images: string[] | null;
  legacy_image_url: string | null;
};

function mapGalleryRow(row: VariantGalleryRow): VariantGalleryContext {
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    finishId: row.finish_id,
    productImages: parsePostgresTextArray(row.product_images),
    finishImages: parsePostgresTextArray(row.finish_images),
    variantImages: row.variant_images ? parsePostgresTextArray(row.variant_images) : null,
    legacyImageUrl: row.legacy_image_url,
  };
}

const VARIANT_GALLERY_SELECT = `
  pv.id AS variant_id,
  pv.product_id,
  pv.finish_id,
  p.images AS product_images,
  df.finish_images,
  pv.variant_images,
  p.image_url AS legacy_image_url
`;

export async function loadVariantGalleryContext(
  variantId: number
): Promise<VariantGalleryContext | null> {
  const result = await query<VariantGalleryRow>(
    `
      SELECT ${VARIANT_GALLERY_SELECT}
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id AND p.deleted_at IS NULL
      JOIN door_finishes df ON df.id = pv.finish_id AND df.deleted_at IS NULL
      WHERE pv.id = $1
        AND pv.deleted_at IS NULL
    `,
    [variantId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapGalleryRow(result.rows[0]);
}

export async function loadVariantGalleryContexts(
  variantIds: number[]
): Promise<Map<number, VariantGalleryContext>> {
  if (variantIds.length === 0) {
    return new Map();
  }

  const result = await query<VariantGalleryRow>(
    `
      SELECT ${VARIANT_GALLERY_SELECT}
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id AND p.deleted_at IS NULL
      JOIN door_finishes df ON df.id = pv.finish_id AND df.deleted_at IS NULL
      WHERE pv.id = ANY($1::int[])
        AND pv.deleted_at IS NULL
    `,
    [variantIds]
  );

  const map = new Map<number, VariantGalleryContext>();

  for (const row of result.rows) {
    map.set(row.variant_id, mapGalleryRow(row));
  }

  return map;
}

export function resolveVariantGallery(context: GallerySources): string[] {
  return mergeGalleryImages(context);
}

export function resolveVariantCover(context: GallerySources): string {
  return galleryCoverUrl(context);
}
