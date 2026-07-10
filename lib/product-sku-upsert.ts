import type { PoolClient } from "pg";
import { stripDeletedSkuSuffix } from "@/lib/soft-delete-sku";

type UpsertProductParams = {
  subCategoryId: number;
  productSku: string;
  productName: string;
  description: string;
  imageUrl?: string | null;
  userId?: number | null;
};

type UpsertVariantParams = {
  productId: number;
  finishId: number;
  widthIn: number;
  heightIn: number;
  depthIn: number;
  stockStatus: "in_stock" | "out_of_stock";
  price: number;
  variantSku: string;
  userId?: number | null;
};

export async function findSoftDeletedProductBySku(client: PoolClient, productSku: string) {
  const result = await client.query<{ id: number }>(
    `
      SELECT id
      FROM products
      WHERE deleted_at IS NOT NULL
        AND (
          sku = $1
          OR sku LIKE $1 || '\\_deleted\\_%' ESCAPE '\\'
        )
      ORDER BY deleted_at DESC
      LIMIT 1
    `,
    [productSku]
  );

  return result.rows[0]?.id ?? null;
}

export async function upsertOrRestoreProduct(
  client: PoolClient,
  params: UpsertProductParams
) {
  const active = await client.query<{ id: number }>(
    "SELECT id FROM products WHERE sku = $1 AND deleted_at IS NULL",
    [params.productSku]
  );

  if (active.rows[0]) {
    await client.query(
      `
        UPDATE products
        SET
          sub_category_id = $1,
          name = $2,
          description = $3,
          image_url = COALESCE($4, image_url),
          updated_at = NOW(),
          updated_by = $5
        WHERE id = $6
          AND deleted_at IS NULL
      `,
      [
        params.subCategoryId,
        params.productName,
        params.description,
        params.imageUrl ?? null,
        params.userId ?? null,
        active.rows[0].id,
      ]
    );

    return { productId: active.rows[0].id, created: false, restored: false };
  }

  const softDeletedProductId = await findSoftDeletedProductBySku(client, params.productSku);

  if (softDeletedProductId) {
    await client.query(
      `
        UPDATE products
        SET
          sub_category_id = $1,
          sku = $2,
          name = $3,
          description = $4,
          image_url = COALESCE($5, image_url),
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = $6
        WHERE id = $7
      `,
      [
        params.subCategoryId,
        params.productSku,
        params.productName,
        params.description,
        params.imageUrl ?? null,
        params.userId ?? null,
        softDeletedProductId,
      ]
    );

    return { productId: softDeletedProductId, created: false, restored: true };
  }

  const inserted = await client.query<{ id: number }>(
    `
      INSERT INTO products (
        sub_category_id,
        sku,
        name,
        description,
        image_url,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING id
    `,
    [
      params.subCategoryId,
      params.productSku,
      params.productName,
      params.description,
      params.imageUrl ?? null,
      params.userId ?? null,
    ]
  );

  return { productId: inserted.rows[0].id, created: true, restored: false };
}

export async function findSoftDeletedVariantByDimensions(
  client: PoolClient,
  params: Pick<UpsertVariantParams, "productId" | "finishId" | "widthIn" | "heightIn" | "depthIn">
) {
  const result = await client.query<{ id: number; sku: string }>(
    `
      SELECT id, sku
      FROM product_variants
      WHERE product_id = $1
        AND finish_id = $2
        AND width_in = $3
        AND height_in = $4
        AND depth_in = $5
        AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
      LIMIT 1
    `,
    [params.productId, params.finishId, params.widthIn, params.heightIn, params.depthIn]
  );

  return result.rows[0] ?? null;
}

export async function findSoftDeletedVariantBySku(client: PoolClient, variantSku: string) {
  const result = await client.query<{ id: number }>(
    `
      SELECT id
      FROM product_variants
      WHERE deleted_at IS NOT NULL
        AND (
          sku = $1
          OR sku LIKE $1 || '\\_deleted\\_%' ESCAPE '\\'
          OR $1 = regexp_replace(sku, '_deleted_[0-9]+$', '')
        )
      ORDER BY deleted_at DESC
      LIMIT 1
    `,
    [variantSku]
  );

  return result.rows[0]?.id ?? null;
}

export async function upsertOrRestoreVariant(
  client: PoolClient,
  params: UpsertVariantParams
) {
  const active = await client.query<{ id: number }>(
    `
      SELECT id
      FROM product_variants
      WHERE product_id = $1
        AND finish_id = $2
        AND width_in = $3
        AND height_in = $4
        AND depth_in = $5
        AND deleted_at IS NULL
    `,
    [params.productId, params.finishId, params.widthIn, params.heightIn, params.depthIn]
  );

  if (active.rows[0]) {
    await client.query(
      `
        UPDATE product_variants
        SET
          stock_status = $1,
          price = $2,
          sku = $3,
          updated_at = NOW(),
          updated_by = $4
        WHERE id = $5
          AND deleted_at IS NULL
      `,
      [
        params.stockStatus,
        params.price,
        params.variantSku,
        params.userId ?? null,
        active.rows[0].id,
      ]
    );

    return { variantId: active.rows[0].id, created: false, restored: false };
  }

  const softDeletedByDimensions = await findSoftDeletedVariantByDimensions(client, params);

  if (softDeletedByDimensions) {
    await client.query(
      `
        UPDATE product_variants
        SET
          stock_status = $1,
          price = $2,
          sku = $3,
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = $4
        WHERE id = $5
      `,
      [
        params.stockStatus,
        params.price,
        params.variantSku,
        params.userId ?? null,
        softDeletedByDimensions.id,
      ]
    );

    return { variantId: softDeletedByDimensions.id, created: false, restored: true };
  }

  const softDeletedBySku = await findSoftDeletedVariantBySku(client, params.variantSku);

  if (softDeletedBySku) {
    await client.query(
      `
        UPDATE product_variants
        SET
          product_id = $1,
          finish_id = $2,
          width_in = $3,
          height_in = $4,
          depth_in = $5,
          stock_status = $6,
          price = $7,
          sku = $8,
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = $9
        WHERE id = $10
      `,
      [
        params.productId,
        params.finishId,
        params.widthIn,
        params.heightIn,
        params.depthIn,
        params.stockStatus,
        params.price,
        params.variantSku,
        params.userId ?? null,
        softDeletedBySku,
      ]
    );

    return { variantId: softDeletedBySku, created: false, restored: true };
  }

  const inserted = await client.query<{ id: number }>(
    `
      INSERT INTO product_variants (
        product_id,
        finish_id,
        width_in,
        height_in,
        depth_in,
        stock_status,
        price,
        sku,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      RETURNING id
    `,
    [
      params.productId,
      params.finishId,
      params.widthIn,
      params.heightIn,
      params.depthIn,
      params.stockStatus,
      params.price,
      params.variantSku,
      params.userId ?? null,
    ]
  );

  return { variantId: inserted.rows[0].id, created: true, restored: false };
}

export async function restoreOrInsertVariant(
  client: PoolClient,
  params: UpsertVariantParams
) {
  const active = await client.query<{ id: number }>(
    `
      SELECT id
      FROM product_variants
      WHERE product_id = $1
        AND finish_id = $2
        AND width_in = $3
        AND height_in = $4
        AND depth_in = $5
        AND deleted_at IS NULL
    `,
    [params.productId, params.finishId, params.widthIn, params.heightIn, params.depthIn]
  );

  if (active.rows[0]) {
    return {
      variantId: active.rows[0].id,
      created: false,
      restored: false,
      skipped: true,
    };
  }

  const result = await upsertOrRestoreVariant(client, params);
  return { ...result, skipped: false };
}

export function matchesLogicalSku(storedSku: string, incomingSku: string) {
  return (
    storedSku === incomingSku ||
    stripDeletedSkuSuffix(storedSku) === incomingSku
  );
}
