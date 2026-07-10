import type { PoolClient } from "pg";
import { pool, query } from "@/lib/db";
import {
  fetchProductSnapshot,
  softDeleteProduct,
  softDeleteVariant,
} from "@/lib/audit-log";

type VariantRef = {
  variant_id: number;
  product_id: number;
  finish_name: string;
  width_in: string;
  height_in: string;
  depth_in: string;
};

export async function loadVariantRef(variantId: number) {
  const result = await query<VariantRef>(
    `
      SELECT
        pv.id AS variant_id,
        pv.product_id,
        df.name AS finish_name,
        pv.width_in::text AS width_in,
        pv.height_in::text AS height_in,
        pv.depth_in::text AS depth_in
      FROM product_variants pv
      JOIN door_finishes df ON df.id = pv.finish_id
      WHERE pv.id = $1
        AND pv.deleted_at IS NULL
        AND df.deleted_at IS NULL
    `,
    [variantId]
  );

  return result.rows[0] ?? null;
}

async function softDeleteVariants(
  client: PoolClient,
  variantIds: number[],
  userId: number | null
) {
  if (variantIds.length === 0) {
    return { deletedVariantIds: [] as number[], deletedProductIds: [] as number[] };
  }

  const deletedVariantIds: number[] = [];

  for (const variantId of variantIds) {
    const deleted = await softDeleteVariant(variantId, userId, client);

    if (deleted) {
      deletedVariantIds.push(variantId);
    }
  }

  const productIds = [
    ...new Set(
      (
        await client.query<{ product_id: number }>(
          `
            SELECT DISTINCT product_id
            FROM product_variants
            WHERE id = ANY($1::int[])
          `,
          [variantIds]
        )
      ).rows.map((row) => row.product_id)
    ),
  ];

  const deletedProductIds: number[] = [];

  for (const productId of productIds) {
    const remaining = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM product_variants
        WHERE product_id = $1
          AND deleted_at IS NULL
      `,
      [productId]
    );

    if (Number.parseInt(remaining.rows[0]?.count ?? "0", 10) === 0) {
      const productSnapshot = await fetchProductSnapshot(productId, client);

      if (productSnapshot && !productSnapshot.deleted_at) {
        const deleted = await softDeleteProduct(productId, userId, client);

        if (deleted) {
          deletedProductIds.push(productId);
        }
      }
    }
  }

  return {
    deletedVariantIds,
    deletedProductIds,
  };
}

export async function deleteProductVariant(variantId: number, userId: number | null) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const variant = await loadVariantRef(variantId);

    if (!variant) {
      await client.query("ROLLBACK");
      return null;
    }

    const result = await softDeleteVariants(client, [variantId], userId);
    await client.query("COMMIT");

    return {
      variant,
      ...result,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteProductVariantGroup(variantId: number, userId: number | null) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const variant = await loadVariantRef(variantId);

    if (!variant) {
      await client.query("ROLLBACK");
      return null;
    }

    const siblings = await client.query<{ id: number }>(
      `
        SELECT id
        FROM product_variants
        WHERE product_id = $1
          AND width_in = $2
          AND height_in = $3
          AND depth_in = $4
          AND deleted_at IS NULL
      `,
      [variant.product_id, variant.width_in, variant.height_in, variant.depth_in]
    );

    const variantIds = siblings.rows.map((row) => row.id);
    const result = await softDeleteVariants(client, variantIds, userId);
    await client.query("COMMIT");

    return {
      variant,
      variantIds,
      ...result,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
