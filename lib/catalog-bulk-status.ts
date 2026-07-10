import { query, pool } from "@/lib/db";
import {
  logProductBulkInStock,
  logProductBulkOutOfStock,
  logProductListingToggle,
} from "@/lib/product-catalog-audit-log";
import { fetchProductSnapshot } from "@/lib/audit-log";

export type CatalogBulkStatusAction = "out_of_stock" | "in_stock" | "toggle_unlist";

export type CatalogBulkStatusResult =
  | {
      action: "out_of_stock" | "in_stock";
      productId: number;
      productName: string;
      updatedVariantCount: number;
    }
  | {
      action: "toggle_unlist";
      productId: number;
      productName: string;
      isListed: boolean;
    };

export async function applyCatalogBulkStatus(params: {
  productId: number;
  action: CatalogBulkStatusAction;
  adminUserId: number;
}): Promise<CatalogBulkStatusResult> {
  const productResult = await query<{ id: number; name: string; is_listed: boolean }>(
    `
      SELECT id, name, is_listed
      FROM products
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [params.productId]
  );

  const product = productResult.rows[0];

  if (!product) {
    throw new Error("Product not found");
  }

  if (params.action === "out_of_stock" || params.action === "in_stock") {
    const targetStatus = params.action === "out_of_stock" ? "out_of_stock" : "in_stock";
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const beforeSnapshot = await fetchProductSnapshot(params.productId, client);

      const updateResult = await client.query<{ id: number }>(
        `
          UPDATE product_variants
          SET stock_status = $2
          WHERE product_id = $1
            AND deleted_at IS NULL
            AND stock_status <> $2
          RETURNING id
        `,
        [params.productId, targetStatus]
      );

      const updatedVariantCount = updateResult.rowCount ?? updateResult.rows.length;

      if (params.action === "out_of_stock") {
        await logProductBulkOutOfStock(
          {
            adminUserId: params.adminUserId,
            productId: params.productId,
            productName: product.name,
            updatedVariantCount,
            beforeSnapshot,
          },
          client
        );
      } else {
        await logProductBulkInStock(
          {
            adminUserId: params.adminUserId,
            productId: params.productId,
            productName: product.name,
            updatedVariantCount,
            beforeSnapshot,
          },
          client
        );
      }

      await client.query("COMMIT");

      return {
        action: params.action,
        productId: params.productId,
        productName: product.name,
        updatedVariantCount,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const client = await pool.connect();
  const nextListed = !product.is_listed;

  try {
    await client.query("BEGIN");

    const beforeSnapshot = await fetchProductSnapshot(params.productId, client);

    await client.query(
      `
        UPDATE products
        SET is_listed = $2
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [params.productId, nextListed]
    );

    const afterSnapshot = await fetchProductSnapshot(params.productId, client);

    await logProductListingToggle(
      {
        adminUserId: params.adminUserId,
        productId: params.productId,
        productName: product.name,
        isListed: nextListed,
        beforeSnapshot,
        afterSnapshot,
      },
      client
    );

    await client.query("COMMIT");

    return {
      action: "toggle_unlist",
      productId: params.productId,
      productName: product.name,
      isListed: nextListed,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
