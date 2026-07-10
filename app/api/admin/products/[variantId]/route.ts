import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import { requireProductUpdatePermission } from "@/lib/admin-mutation-auth";
import { parseSanitizedAdminProductDeleteScope } from "@/lib/admin-search-sanitization";
import { mapCatalogRow } from "@/lib/catalog";
import { pool, query } from "@/lib/db";
import { parseUpdateProductBody, buildVariantSku } from "@/lib/product-admin";
import {
  deleteProductVariant,
  deleteProductVariantGroup,
} from "@/lib/product-delete";
import {
  fetchProductSnapshot,
  fetchVariantSnapshot,
  writeAuditLog,
} from "@/lib/audit-log";
import {
  loadVariantGalleryContext,
  resolveVariantGallery,
} from "@/lib/gallery-context";
import type { AdminProductDetail } from "@/types/admin";
import type { CatalogProductRow } from "@/types/catalog";

type RouteContext = {
  params: Promise<{ variantId: string }>;
};

type ProductDetailRow = CatalogProductRow & {
  product_id: number;
};

function mapAdminProductDetail(
  row: ProductDetailRow,
  finishIds: number[],
  siblingVariants: Awaited<ReturnType<typeof loadSiblingVariants>>,
  gallery: Awaited<ReturnType<typeof loadVariantGalleryContext>>
): AdminProductDetail {
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    categorySlug: row.category_slug,
    subCategorySlug: row.sub_category_slug,
    productSku: row.product_sku,
    productName: row.product_name,
    description: row.description ?? "",
    imageUrl: row.image_url,
    productImages: gallery ? [...gallery.productImages] : [],
    variantImages: gallery?.variantImages ? [...gallery.variantImages] : [],
    finishImages: gallery ? [...gallery.finishImages] : [],
    widthIn: Number.parseFloat(row.width_in),
    heightIn: Number.parseFloat(row.height_in),
    depthIn: Number.parseFloat(row.depth_in),
    color: row.color,
    finishId: row.finish_id,
    finishName: row.color,
    finishSlug: row.finish_slug,
    finishIds,
    siblings: siblingVariants,
    stockStatus: row.stock_status,
    price: Number.parseFloat(row.price),
    variantSku: row.variant_sku,
    category: row.category,
    subCategory: row.sub_category,
  };
}

const PRODUCT_DETAIL_QUERY = `
  SELECT
    pv.product_id,
    cp.variant_id,
    cp.variant_sku,
    cp.product_sku,
    cp.product_name,
    cp.description,
    cp.image_url,
    cp.category,
    cp.category_slug,
    cp.sub_category,
    cp.sub_category_slug,
    cp.width_in,
    cp.height_in,
    cp.depth_in,
    cp.color,
    cp.finish_id,
    cp.finish_slug,
    cp.stock_status,
    cp.price
  FROM catalog_products cp
  JOIN product_variants pv ON pv.id = cp.variant_id
`;

async function loadSiblingVariants(
  productId: number,
  widthIn: number,
  heightIn: number,
  depthIn: number
) {
  const siblingRows = await query<{
    variant_id: number;
    finish_id: number;
    finish_name: string;
    finish_slug: string;
    variant_sku: string;
    stock_status: "in_stock" | "out_of_stock";
    price: string;
  }>(
    `
      SELECT
        cp.variant_id,
        cp.finish_id,
        cp.color AS finish_name,
        cp.finish_slug,
        cp.variant_sku,
        cp.stock_status,
        cp.price
      FROM catalog_products cp
      JOIN product_variants pv ON pv.id = cp.variant_id
      WHERE pv.product_id = $1
        AND pv.width_in = $2
        AND pv.height_in = $3
        AND pv.depth_in = $4
      ORDER BY cp.color ASC, cp.variant_id ASC
    `,
    [productId, widthIn, heightIn, depthIn]
  );

  return siblingRows.rows.map((row) => ({
    variantId: row.variant_id,
    finishId: row.finish_id,
    finishName: row.finish_name,
    finishSlug: row.finish_slug,
    variantSku: row.variant_sku,
    stockStatus: row.stock_status,
    price: Number.parseFloat(row.price),
  }));
}

export async function GET(_request: Request, context: RouteContext) {
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

  const { variantId } = await context.params;
  const id = Number.parseInt(variantId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid variant id" }, { status: 400 });
  }

  try {
    const result = await query<ProductDetailRow>(
      `${PRODUCT_DETAIL_QUERY} WHERE cp.variant_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const row = result.rows[0];
    const widthIn = Number.parseFloat(row.width_in);
    const heightIn = Number.parseFloat(row.height_in);
    const depthIn = Number.parseFloat(row.depth_in);
    const siblingVariants = await loadSiblingVariants(
      row.product_id,
      widthIn,
      heightIn,
      depthIn
    );
    const finishIds = siblingVariants.map((variant) => variant.finishId);
    const galleryContext = await loadVariantGalleryContext(id);

    return NextResponse.json({
      product: mapAdminProductDetail(row, finishIds, siblingVariants, galleryContext),
      mergedGallery: galleryContext ? resolveVariantGallery(galleryContext) : [],
    });
  } catch (error) {
    console.error("GET /api/admin/products/[variantId] failed:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

function serializeSnapshot(row: Record<string, unknown> | null) {
  if (!row) {
    return null;
  }

  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { variantId } = await context.params;
  const id = Number.parseInt(variantId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid variant id" }, { status: 400 });
  }

  const body = parseUpdateProductBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid product payload" }, { status: 400 });
  }

  const existing = await query<{
    product_id: number;
    product_sku: string;
    product_name: string;
    product_description: string | null;
    sub_category_id: number;
    width_in: string;
    height_in: string;
    depth_in: string;
    stock_status: "in_stock" | "out_of_stock";
    price: string;
    variant_sku: string;
    finish_id: number;
  }>(
    `
      SELECT
        pv.product_id,
        p.sku AS product_sku,
        p.name AS product_name,
        p.description AS product_description,
        p.sub_category_id,
        pv.width_in,
        pv.height_in,
        pv.depth_in,
        pv.stock_status,
        pv.price,
        pv.sku AS variant_sku,
        pv.finish_id
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = $1
        AND pv.deleted_at IS NULL
        AND p.deleted_at IS NULL
    `,
    [id]
  );

  if (existing.rows.length === 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

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

  const row = existing.rows[0];
  const auth = await requireProductUpdatePermission(
    {
      width_in: row.width_in,
      height_in: row.height_in,
      depth_in: row.depth_in,
      stock_status: row.stock_status,
      price: row.price,
      sku: row.variant_sku,
    },
    {
      name: row.product_name,
      description: row.product_description,
      sub_category_id: row.sub_category_id,
      image_url: null,
    },
    body,
    subCategory.rows[0].id
  );

  if (auth.response) {
    return auth.response;
  }

  const userId = auth.user!.id;

  if (
    body.finishIds.length !== 1 ||
    body.finishIds[0] !== row.finish_id
  ) {
    return NextResponse.json(
      { error: "Edit one finish variant at a time from this page." },
      { status: 400 }
    );
  }

  const finishRows = await query<{ id: number; name: string }>(
    `
      SELECT id, name
      FROM door_finishes
      WHERE id = ANY($1::int[])
      ORDER BY id
    `,
    [body.finishIds]
  );

  if (finishRows.rows.length !== body.finishIds.length) {
    return NextResponse.json({ error: "One or more door finishes not found" }, { status: 400 });
  }

  const productId = row.product_id;
  const productSku = row.product_sku;
  const finish = finishRows.rows[0];
  const variantSku =
    body.variantSku?.trim() ||
    buildVariantSku(
      productSku,
      finish.name,
      body.widthIn,
      body.heightIn,
      body.depthIn
    );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const variantBefore = serializeSnapshot(await fetchVariantSnapshot(id, client));
    const productBefore = serializeSnapshot(
      await fetchProductSnapshot(productId, client)
    );

    if (body.imageUrl !== undefined) {
      await client.query(
        `
          UPDATE products
          SET
            sub_category_id = $1,
            name = $2,
            description = $3,
            image_url = $4,
            updated_at = NOW(),
            updated_by = $6
          WHERE id = $5
            AND deleted_at IS NULL
        `,
        [
          subCategory.rows[0].id,
          body.productName,
          body.description,
          body.imageUrl,
          productId,
          userId,
        ]
      );
    } else {
      await client.query(
        `
          UPDATE products
          SET
            sub_category_id = $1,
            name = $2,
            description = $3,
            updated_at = NOW(),
            updated_by = $5
          WHERE id = $4
            AND deleted_at IS NULL
        `,
        [subCategory.rows[0].id, body.productName, body.description, productId, userId]
      );
    }

    await client.query(
      `
        UPDATE product_variants
        SET
          width_in = $1,
          height_in = $2,
          depth_in = $3,
          stock_status = $4,
          price = $5,
          sku = $6,
          updated_at = NOW(),
          updated_by = $8
        WHERE id = $7
          AND deleted_at IS NULL
      `,
      [
        body.widthIn,
        body.heightIn,
        body.depthIn,
        body.stockStatus,
        body.price,
        variantSku,
        id,
        userId,
      ]
    );

    const variantAfter = serializeSnapshot(await fetchVariantSnapshot(id, client));
    const productAfter = serializeSnapshot(await fetchProductSnapshot(productId, client));

    if (variantBefore && variantAfter) {
      await writeAuditLog(
        {
          userId,
          action: "UPDATE",
          tableName: "product_variants",
          recordId: id,
          oldValues: variantBefore,
          newValues: variantAfter,
        },
        client
      );
    }

    if (productBefore && productAfter) {
      await writeAuditLog(
        {
          userId,
          action: "UPDATE",
          tableName: "products",
          recordId: productId,
          oldValues: productBefore,
          newValues: productAfter,
        },
        client
      );
    }

    await client.query("COMMIT");

    const updated = await query<ProductDetailRow>(
      `${PRODUCT_DETAIL_QUERY} WHERE cp.variant_id = $1`,
      [id]
    );

    const siblingDetails = await loadSiblingVariants(
      productId,
      body.widthIn,
      body.heightIn,
      body.depthIn
    );
    const finishIds = siblingDetails.map((variant) => variant.finishId);

    const galleryContext = await loadVariantGalleryContext(id);

    return NextResponse.json({
      product: mapCatalogRow(updated.rows[0]),
      detail: mapAdminProductDetail(updated.rows[0], finishIds, siblingDetails, galleryContext),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Variant SKU already exists" }, { status: 409 });
    }

    console.error("PATCH /api/admin/products/[variantId] failed:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_delete_products");

  if (auth.response) {
    return auth.response;
  }

  const { variantId } = await context.params;
  const id = Number.parseInt(variantId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid variant id" }, { status: 400 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedScope = await parseSanitizedAdminProductDeleteScope(
    request,
    searchParams,
    auth.user!.id
  );

  if (parsedScope.blocked) {
    return parsedScope.blocked;
  }

  try {
    const result =
      parsedScope.scope === "group"
        ? await deleteProductVariantGroup(id, auth.user!.id)
        : await deleteProductVariant(id, auth.user!.id);

    if (!result) {
      return NextResponse.json({ error: "Product variant not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      deletedVariantIds: result.deletedVariantIds,
      deletedProductIds: result.deletedProductIds,
    });
  } catch (error) {
    console.error("DELETE /api/admin/products/[variantId] failed:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
