import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import { parseSanitizedAdminProductListQuery } from "@/lib/admin-search-sanitization";
import { pool, query } from "@/lib/db";
import { mapCatalogRow } from "@/lib/catalog";
import { parseCreateProductBody, buildVariantSku } from "@/lib/product-admin";
import {
  fetchProductSnapshot,
  fetchVariantSnapshot,
  writeAuditLog,
} from "@/lib/audit-log";
import {
  upsertOrRestoreProduct,
  restoreOrInsertVariant,
} from "@/lib/product-sku-upsert";
import type { AdminProductRow } from "@/types/admin";
import type { CatalogProductRow } from "@/types/catalog";

export async function GET(request: Request) {
  const auth = await requireAnyAdminPermission([
    "can_view_products",
    "can_add_products",
    "can_delete_products",
    "can_toggle_products",
    "can_bulk_upload_products",
  ]);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = await parseSanitizedAdminProductListQuery(
      request,
      searchParams,
      auth.user!.id
    );

    if (parsed.blocked) {
      return parsed.blocked;
    }

    const search = parsed.search;
    const category = parsed.category;
    const stockStatus = parsed.stockStatus;
    const finishFilter = parsed.finishFilter;

    const conditions: string[] = [];
    const values: string[] = [];

    if (search) {
      values.push(`%${search}%`);
      const index = values.length;
      conditions.push(
        `(
        product_name ILIKE $${index}
        OR product_sku ILIKE $${index}
        OR variant_sku ILIKE $${index}
        OR category ILIKE $${index}
        OR sub_category ILIKE $${index}
        OR color ILIKE $${index}
        OR finish_name ILIKE $${index}
        OR finish_slug ILIKE $${index}
      )`
      );
    }

    if (category && category !== "all") {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (stockStatus !== "all") {
      values.push(stockStatus);
      conditions.push(`stock_status = $${values.length}`);
    }

    if (finishFilter && finishFilter !== "all") {
      values.push(finishFilter);
      conditions.push(`finish_name = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query<AdminProductRow>(
      `
        SELECT
          product_id,
          variant_id,
          variant_sku,
          product_sku,
          product_name,
          is_listed,
          category,
          sub_category,
          width_in,
          height_in,
          depth_in,
          color,
          finish_id,
          finish_slug,
          color AS finish_name,
          stock_status,
          price,
          image_url
        FROM catalog_products
        ${whereClause}
        ORDER BY variant_id DESC
      `,
      values
    );

    return NextResponse.json({ products: result.rows });
  } catch (error) {
    console.error("GET /api/admin/products failed:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  const userId = auth.user!.id;
  const body = parseCreateProductBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid product payload" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const subCategory = await query<{ id: number }>(
      `
        SELECT sc.id
        FROM sub_categories sc
        JOIN categories c ON c.id = sc.category_id
        WHERE c.slug = $1 AND sc.slug = $2
      `,
      [body.categorySlug, body.subCategorySlug]
    );

    if (subCategory.rows.length === 0) {
      return NextResponse.json({ error: "Category or sub-category not found" }, { status: 400 });
    }

    const finishRows = await query<{ id: number; name: string }>(
      `
        SELECT id, name
        FROM door_finishes
        WHERE id = ANY($1::int[])
          AND deleted_at IS NULL
        ORDER BY id
      `,
      [body.finishIds]
    );

    if (finishRows.rows.length !== body.finishIds.length) {
      return NextResponse.json({ error: "One or more door finishes not found" }, { status: 400 });
    }

    await client.query("BEGIN");

    const activeProductBefore = await client.query<{ id: number }>(
      "SELECT id FROM products WHERE sku = $1 AND deleted_at IS NULL",
      [body.productSku]
    );
    const productBefore =
      activeProductBefore.rows[0] !== undefined
        ? await fetchProductSnapshot(activeProductBefore.rows[0].id, client)
        : null;

    const productResult = await upsertOrRestoreProduct(client, {
      subCategoryId: subCategory.rows[0].id,
      productSku: body.productSku,
      productName: body.productName,
      description: body.description,
      imageUrl: body.imageUrl,
      userId,
    });

    const productId = productResult.productId;
    const productAfter = await fetchProductSnapshot(productId, client);

    if (productAfter) {
      if (productResult.created) {
        await writeAuditLog(
          {
            userId,
            action: "CREATE",
            tableName: "products",
            recordId: productId,
            newValues: JSON.parse(JSON.stringify(productAfter)),
          },
          client
        );
      } else if (productResult.restored) {
        await writeAuditLog(
          {
            userId,
            action: "RESTORE",
            tableName: "products",
            recordId: productId,
            newValues: JSON.parse(JSON.stringify(productAfter)),
          },
          client
        );
      } else if (productBefore) {
        await writeAuditLog(
          {
            userId,
            action: "UPDATE",
            tableName: "products",
            recordId: productId,
            oldValues: JSON.parse(JSON.stringify(productBefore)),
            newValues: JSON.parse(JSON.stringify(productAfter)),
          },
          client
        );
      }
    }

    if (body.productImages.length > 0) {
      await client.query(
        `
          UPDATE products
          SET
            images = $1::text[],
            image_url = ($1::text[])[1],
            updated_at = NOW(),
            updated_by = $2
          WHERE id = $3
        `,
        [body.productImages, userId, productId]
      );
    }

    let createdCount = 0;
    let skippedCount = 0;
    let firstVariantSku: string | null = null;

    for (const finish of finishRows.rows) {
      const variantSku =
        body.finishIds.length === 1 && body.variantSku
          ? body.variantSku
          : buildVariantSku(
              body.productSku,
              finish.name,
              body.widthIn,
              body.heightIn,
              body.depthIn
            );

      const variantResult = await restoreOrInsertVariant(client, {
        productId,
        finishId: finish.id,
        widthIn: body.widthIn,
        heightIn: body.heightIn,
        depthIn: body.depthIn,
        stockStatus: body.stockStatus,
        price: body.finishPrices[finish.id] ?? body.price,
        variantSku,
        userId,
      });

      if (variantResult.skipped) {
        skippedCount += 1;
        continue;
      }

      const variantAfter = await fetchVariantSnapshot(variantResult.variantId, client);

      if (variantAfter) {
        await writeAuditLog(
          {
            userId,
            action: variantResult.restored ? "RESTORE" : "CREATE",
            tableName: "product_variants",
            recordId: variantResult.variantId,
            newValues: JSON.parse(JSON.stringify(variantAfter)),
          },
          client
        );
      }

      createdCount += 1;

      if (!firstVariantSku) {
        firstVariantSku = variantSku;
      }
    }

    if (createdCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error:
            "All selected finishes already exist for this product and dimensions.",
        },
        { status: 409 }
      );
    }

    await client.query("COMMIT");

    const created = await query<CatalogProductRow>(
      `
        SELECT
          variant_id,
          variant_sku,
          product_sku,
          product_name,
          description,
          image_url,
          category,
          category_slug,
          sub_category,
          sub_category_slug,
          width_in,
          height_in,
          depth_in,
          color,
          stock_status,
          price
        FROM catalog_products
        WHERE product_sku = $1 AND variant_sku = $2
      `,
      [body.productSku, firstVariantSku]
    );

    return NextResponse.json(
      {
        product: mapCatalogRow(created.rows[0]),
        createdCount,
        skippedCount,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "Product SKU or variant SKU already exists" },
        { status: 409 }
      );
    }

    console.error("POST /api/admin/products failed:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  } finally {
    client.release();
  }
}
