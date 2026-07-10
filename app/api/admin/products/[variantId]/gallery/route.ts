import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import { filterAllowedImageUrls } from "@/lib/safe-image-url";
import { query, pool } from "@/lib/db";
import {
  loadVariantGalleryContext,
  resolveVariantGallery,
} from "@/lib/gallery-context";
import { fetchProductSnapshot, fetchVariantSnapshot, writeAuditLog } from "@/lib/audit-log";

type RouteContext = {
  params: Promise<{ variantId: string }>;
};

function parseGalleryPatchBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const result: {
    productImages?: string[];
    variantImages?: string[] | null;
  } = {};

  if ("productImages" in candidate) {
    if (!Array.isArray(candidate.productImages)) {
      return null;
    }

    result.productImages = filterAllowedImageUrls(
      candidate.productImages
        .filter((url): url is string => typeof url === "string" && url.trim() !== "")
        .map((url) => url.trim())
    );
  }

  if ("variantImages" in candidate) {
    if (candidate.variantImages === null) {
      result.variantImages = null;
    } else if (Array.isArray(candidate.variantImages)) {
      result.variantImages = filterAllowedImageUrls(
        candidate.variantImages
          .filter((url): url is string => typeof url === "string" && url.trim() !== "")
          .map((url) => url.trim())
      );
    } else {
      return null;
    }
  }

  if (result.productImages === undefined && result.variantImages === undefined) {
    return null;
  }

  return result;
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
    const galleryContext = await loadVariantGalleryContext(id);

    if (!galleryContext) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({
      productImages: galleryContext.productImages,
      finishImages: galleryContext.finishImages,
      variantImages: galleryContext.variantImages ?? [],
      mergedGallery: resolveVariantGallery(galleryContext),
    });
  } catch (error) {
    console.error("GET /api/admin/products/[variantId]/gallery failed:", error);
    return NextResponse.json({ error: "Failed to load gallery" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  const userId = auth.user!.id;
  const { variantId } = await context.params;
  const id = Number.parseInt(variantId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid variant id" }, { status: 400 });
  }

  const body = parseGalleryPatchBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid gallery payload" }, { status: 400 });
  }

  const existing = await query<{ product_id: number }>(
    `
      SELECT product_id
      FROM product_variants
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [id]
  );

  if (existing.rows.length === 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const productId = existing.rows[0].product_id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productBefore = await fetchProductSnapshot(productId, client);
    const variantBefore = await fetchVariantSnapshot(id, client);

    if (body.productImages !== undefined) {
      await client.query(
        `
          UPDATE products
          SET
            images = $1::text[],
            image_url = CASE
              WHEN cardinality($1::text[]) > 0 THEN ($1::text[])[1]
              ELSE NULL
            END,
            updated_at = NOW(),
            updated_by = $2
          WHERE id = $3
            AND deleted_at IS NULL
        `,
        [body.productImages, userId, productId]
      );
    }

    if (body.variantImages !== undefined) {
      await client.query(
        `
          UPDATE product_variants
          SET
            variant_images = $1::text[],
            updated_at = NOW(),
            updated_by = $3
          WHERE id = $2
            AND deleted_at IS NULL
        `,
        [body.variantImages, id, userId]
      );
    }

    const productAfter = await fetchProductSnapshot(productId, client);
    const variantAfter = await fetchVariantSnapshot(id, client);

    if (productBefore && productAfter && body.productImages !== undefined) {
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

    if (variantBefore && variantAfter && body.variantImages !== undefined) {
      await writeAuditLog(
        {
          userId,
          action: "UPDATE",
          tableName: "product_variants",
          recordId: id,
          oldValues: JSON.parse(JSON.stringify(variantBefore)),
          newValues: JSON.parse(JSON.stringify(variantAfter)),
        },
        client
      );
    }

    await client.query("COMMIT");

    const galleryContext = await loadVariantGalleryContext(id);

    if (!galleryContext) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({
      productImages: galleryContext.productImages,
      finishImages: galleryContext.finishImages,
      variantImages: galleryContext.variantImages ?? [],
      mergedGallery: resolveVariantGallery(galleryContext),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("PATCH /api/admin/products/[variantId]/gallery failed:", error);
    return NextResponse.json({ error: "Failed to update gallery" }, { status: 500 });
  } finally {
    client.release();
  }
}
