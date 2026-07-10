import type { PoolClient } from "pg";
import { pool, query } from "@/lib/db";
import type { ProductImage } from "@/types/catalog";

type ProductImageRow = {
  id: number;
  product_id: number;
  finish_id: number;
  image_url: string;
  sort_order: number;
  is_cover: boolean;
};

export function mapProductImageRow(row: ProductImageRow): ProductImage {
  return {
    id: row.id,
    productId: row.product_id,
    finishId: row.finish_id,
    url: row.image_url,
    sortOrder: row.sort_order,
    isCover: row.is_cover,
  };
}

export async function loadProductImages(productId: number, finishId?: number) {
  const values: number[] = [productId];
  let finishClause = "";

  if (finishId !== undefined) {
    values.push(finishId);
    finishClause = "AND finish_id = $2";
  }

  const result = await query<ProductImageRow>(
    `
      SELECT id, product_id, finish_id, image_url, sort_order, is_cover
      FROM product_images
      WHERE product_id = $1
      ${finishClause}
      ORDER BY finish_id ASC, sort_order ASC, id ASC
    `,
    values
  );

  return result.rows.map(mapProductImageRow);
}

export async function loadProductImagesForCatalog(
  productIds: number[],
  finishIds: number[]
) {
  if (productIds.length === 0) {
    return new Map<string, string[]>();
  }

  const values: number[][] = [productIds];
  let finishFilterClause = "";
  if (finishIds.length > 0) {
    values.push(finishIds);
    finishFilterClause = "AND finish_id = ANY($2::int[])";
  }

  const result = await query<{
    product_id: number;
    finish_id: number;
    image_url: string;
  }>(
    `
      SELECT product_id, finish_id, image_url
      FROM product_images
      WHERE product_id = ANY($1::int[])
      ${finishFilterClause}
      ORDER BY product_id ASC, finish_id ASC, sort_order ASC, id ASC
    `,
    values
  );

  const map = new Map<string, string[]>();

  for (const row of result.rows) {
    const key = `${row.product_id}:${row.finish_id}`;
    const current = map.get(key) ?? [];
    current.push(row.image_url);
    map.set(key, current);
  }

  return map;
}

async function syncProductCoverUrl(client: PoolClient, productId: number, finishId: number) {
  const cover = await client.query<{ image_url: string | null }>(
    `
      SELECT image_url
      FROM product_images
      WHERE product_id = $1
        AND finish_id = $2
        AND is_cover = true
      ORDER BY sort_order ASC, id ASC
      LIMIT 1
    `,
    [productId, finishId]
  );

  const fallback = await client.query<{ image_url: string | null }>(
    `
      SELECT image_url
      FROM product_images
      WHERE product_id = $1 AND finish_id = $2
      ORDER BY sort_order ASC, id ASC
      LIMIT 1
    `,
    [productId, finishId]
  );

  const imageUrl = cover.rows[0]?.image_url ?? fallback.rows[0]?.image_url ?? null;

  await client.query(
    `
      UPDATE products
      SET image_url = $1
      WHERE id = $2
        AND (
          image_url IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM product_images WHERE product_id = $2 AND is_cover = true
          )
        )
    `,
    [imageUrl, productId]
  );
}

export async function insertProductImages(
  client: PoolClient,
  productId: number,
  finishId: number,
  urls: string[],
  coverUrl?: string | null
) {
  const uniqueUrls = [...new Set(urls.filter((url) => url.trim()))];

  if (uniqueUrls.length === 0) {
    return;
  }

  const cover =
    coverUrl && uniqueUrls.includes(coverUrl) ? coverUrl : uniqueUrls[0];

  for (let index = 0; index < uniqueUrls.length; index += 1) {
    const url = uniqueUrls[index];

    const existing = await client.query<{ id: number }>(
      `
        SELECT id
        FROM product_images
        WHERE product_id = $1
          AND finish_id = $2
          AND image_url = $3
      `,
      [productId, finishId, url]
    );

    if (existing.rows.length > 0) {
      continue;
    }

    await client.query(
      `
        INSERT INTO product_images (product_id, finish_id, image_url, sort_order, is_cover)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [productId, finishId, url, index, url === cover]
    );
  }

  await syncProductCoverUrl(client, productId, finishId);
}

export async function setProductCoverImage(
  productId: number,
  finishId: number,
  imageId: number
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const image = await client.query<{ id: number }>(
      `
        SELECT id
        FROM product_images
        WHERE id = $1
          AND product_id = $2
          AND finish_id = $3
      `,
      [imageId, productId, finishId]
    );

    if (image.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `
        UPDATE product_images
        SET is_cover = false
        WHERE product_id = $1 AND finish_id = $2
      `,
      [productId, finishId]
    );
    await client.query(
      "UPDATE product_images SET is_cover = true WHERE id = $1",
      [imageId]
    );
    await syncProductCoverUrl(client, productId, finishId);

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteProductImage(
  productId: number,
  finishId: number,
  imageId: number
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const deleted = await client.query<{ id: number; is_cover: boolean }>(
      `
        DELETE FROM product_images
        WHERE id = $1
          AND product_id = $2
          AND finish_id = $3
        RETURNING id, is_cover
      `,
      [imageId, productId, finishId]
    );

    if (deleted.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    if (deleted.rows[0].is_cover) {
      const nextCover = await client.query<{ id: number }>(
        `
          SELECT id
          FROM product_images
          WHERE product_id = $1 AND finish_id = $2
          ORDER BY sort_order ASC, id ASC
          LIMIT 1
        `,
        [productId, finishId]
      );

      if (nextCover.rows.length > 0) {
        await client.query(
          "UPDATE product_images SET is_cover = true WHERE id = $1",
          [nextCover.rows[0].id]
        );
      }
    }

    await syncProductCoverUrl(client, productId, finishId);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reorderProductImages(
  productId: number,
  finishId: number,
  imageIds: number[]
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: number }>(
      `
        SELECT id
        FROM product_images
        WHERE product_id = $1 AND finish_id = $2
        ORDER BY sort_order ASC, id ASC
      `,
      [productId, finishId]
    );

    const existingIds = existing.rows.map((row) => row.id);

    if (
      imageIds.length !== existingIds.length ||
      !imageIds.every((id) => existingIds.includes(id))
    ) {
      await client.query("ROLLBACK");
      return false;
    }

    for (let index = 0; index < imageIds.length; index += 1) {
      await client.query(
        `
          UPDATE product_images
          SET sort_order = $1
          WHERE id = $2
            AND product_id = $3
            AND finish_id = $4
        `,
        [index, imageIds[index], productId, finishId]
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function addProductImage(
  productId: number,
  finishId: number,
  imageUrl: string,
  asCover = false
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sortOrder = await client.query<{ next_order: number }>(
      `
        SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
        FROM product_images
        WHERE product_id = $1 AND finish_id = $2
      `,
      [productId, finishId]
    );

    const hasCover = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM product_images
        WHERE product_id = $1
          AND finish_id = $2
          AND is_cover = true
      `,
      [productId, finishId]
    );

    const shouldCover =
      asCover || Number.parseInt(hasCover.rows[0]?.count ?? "0", 10) === 0;

    if (shouldCover) {
      await client.query(
        `
          UPDATE product_images
          SET is_cover = false
          WHERE product_id = $1 AND finish_id = $2
        `,
        [productId, finishId]
      );
    }

    const inserted = await client.query<ProductImageRow>(
      `
        INSERT INTO product_images (product_id, finish_id, image_url, sort_order, is_cover)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, product_id, finish_id, image_url, sort_order, is_cover
      `,
      [productId, finishId, imageUrl, sortOrder.rows[0]?.next_order ?? 0, shouldCover]
    );

    await syncProductCoverUrl(client, productId, finishId);
    await client.query("COMMIT");

    return mapProductImageRow(inserted.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
