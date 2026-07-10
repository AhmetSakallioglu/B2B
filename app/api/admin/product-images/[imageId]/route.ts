import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  deleteProductImage,
  loadProductImages,
  setProductCoverImage,
} from "@/lib/product-images";
import {
  logProductCoverImageSet,
  logProductImageDeleted,
} from "@/lib/product-catalog-audit-log";
import { query } from "@/lib/db";

type RouteContext = {
  params: Promise<{ imageId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  const { imageId } = await context.params;
  const id = Number.parseInt(imageId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid image id" }, { status: 400 });
  }

  const body = await request.json();

  if (!body || typeof body !== "object" || (body as Record<string, unknown>).isCover !== true) {
    return NextResponse.json({ error: "Invalid image update payload" }, { status: 400 });
  }

  try {
    const image = await query<{ product_id: number; finish_id: number }>(
      "SELECT product_id, finish_id FROM product_images WHERE id = $1",
      [id]
    );

    if (image.rows.length === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const { product_id: productId, finish_id: finishId } = image.rows[0];
    const updated = await setProductCoverImage(productId, finishId, id);

    if (!updated) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    await logProductCoverImageSet({
      adminUserId: auth.user!.id,
      productId,
      imageId: id,
      finishId,
    });

    const images = await loadProductImages(productId, finishId);

    return NextResponse.json({ images });
  } catch (error) {
    console.error("PATCH /api/admin/product-images/[imageId] failed:", error);
    return NextResponse.json({ error: "Failed to update product image" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_delete_products");

  if (auth.response) {
    return auth.response;
  }

  const { imageId } = await context.params;
  const id = Number.parseInt(imageId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid image id" }, { status: 400 });
  }

  try {
    const image = await query<{ product_id: number; finish_id: number }>(
      "SELECT product_id, finish_id FROM product_images WHERE id = $1",
      [id]
    );

    if (image.rows.length === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const { product_id: productId, finish_id: finishId } = image.rows[0];
    const deleted = await deleteProductImage(productId, finishId, id);

    if (!deleted) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    await logProductImageDeleted({
      adminUserId: auth.user!.id,
      productId,
      imageId: id,
      finishId,
    });

    const images = await loadProductImages(productId, finishId);

    return NextResponse.json({ images });
  } catch (error) {
    console.error("DELETE /api/admin/product-images/[imageId] failed:", error);
    return NextResponse.json({ error: "Failed to delete product image" }, { status: 500 });
  }
}
