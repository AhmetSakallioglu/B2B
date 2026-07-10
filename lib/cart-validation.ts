import { query } from "@/lib/db";
import { CART_UNAVAILABLE_MESSAGE } from "@/lib/cart-validation.constants";

export { CART_UNAVAILABLE_MESSAGE };

type VariantAvailabilityRow = {
  variant_id: number;
  finish_active: boolean;
  stock_status: "in_stock" | "out_of_stock";
  variant_deleted: boolean;
  product_deleted: boolean;
  finish_deleted: boolean;
};

export function isVariantAvailable(row: {
  finish_active: boolean;
  stock_status: string;
  variant_deleted?: boolean;
  product_deleted?: boolean;
  finish_deleted?: boolean;
}): boolean {
  if (row.variant_deleted || row.product_deleted || row.finish_deleted) {
    return false;
  }

  if (!row.finish_active) {
    return false;
  }

  return row.stock_status === "in_stock";
}

export async function getVariantAvailabilityMap(
  variantIds: number[]
): Promise<Map<number, boolean>> {
  const uniqueIds = [...new Set(variantIds.filter((id) => Number.isInteger(id) && id > 0))];
  const map = new Map<number, boolean>();

  if (uniqueIds.length === 0) {
    return map;
  }

  for (const id of uniqueIds) {
    map.set(id, false);
  }

  const result = await query<VariantAvailabilityRow>(
    `
      SELECT
        pv.id AS variant_id,
        COALESCE(df.is_active, false) AS finish_active,
        pv.stock_status,
        pv.deleted_at IS NOT NULL AS variant_deleted,
        p.deleted_at IS NOT NULL AS product_deleted,
        df.deleted_at IS NOT NULL AS finish_deleted
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      JOIN door_finishes df ON df.id = pv.finish_id
      WHERE pv.id = ANY($1::int[])
    `,
    [uniqueIds]
  );

  for (const row of result.rows) {
    map.set(row.variant_id, isVariantAvailable(row));
  }

  return map;
}

export async function getUnavailableVariantIds(variantIds: number[]): Promise<number[]> {
  const availability = await getVariantAvailabilityMap(variantIds);
  return variantIds.filter((id) => availability.get(id) !== true);
}
