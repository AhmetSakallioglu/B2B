import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import {
  addProductImage,
  loadProductImages,
  reorderProductImages,
} from "@/lib/product-images";
import {
  logProductImageAdded,
  logProductImagesReordered,
} from "@/lib/product-catalog-audit-log";
import { isAllowedImageUrl } from "@/lib/safe-image-url";
import { query } from "@/lib/db";

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

  const { searchParams } = new URL(request.url);
  const productId = Number.parseInt(searchParams.get("productId") ?? "", 10);
  const finishId = Number.parseInt(searchParams.get("finishId") ?? "", 10);

  if (Number.isNaN(productId) || Number.isNaN(finishId)) {
    return NextResponse.json({ error: "Invalid product or finish id" }, { status: 400 });
  }

  try {
    const product = await query<{ id: number }>(
      "SELECT id FROM products WHERE id = $1",
      [productId]
    );

    if (product.rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const images = await loadProductImages(productId, finishId);

    return NextResponse.json({ images });
  } catch (error) {
    console.error("GET /api/admin/product-images failed:", error);
    return NextResponse.json({ error: "Failed to fetch product images" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  const body = await request.json();

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const candidate = body as Record<string, unknown>;
  const productId = Number.parseInt(String(candidate.productId ?? ""), 10);
  const finishId = Number.parseInt(String(candidate.finishId ?? ""), 10);
  const imageUrl =
    typeof candidate.imageUrl === "string" && candidate.imageUrl.trim()
      ? candidate.imageUrl.trim()
      : "";
  const asCover = candidate.asCover === true;

  if (Number.isNaN(productId) || Number.isNaN(finishId) || !imageUrl) {
    return NextResponse.json({ error: "Invalid product image payload" }, { status: 400 });
  }

  if (!isAllowedImageUrl(imageUrl)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  try {
    const product = await query<{ id: number }>(
      "SELECT id FROM products WHERE id = $1",
      [productId]
    );

    if (product.rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const image = await addProductImage(productId, finishId, imageUrl, asCover);

    await logProductImageAdded({
      adminUserId: auth.user!.id,
      productId,
      imageId: image.id,
      finishId,
      asCover,
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/product-images failed:", error);
    return NextResponse.json({ error: "Failed to add product image" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  const body = await request.json();

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const candidate = body as Record<string, unknown>;
  const productId = Number.parseInt(String(candidate.productId ?? ""), 10);
  const finishId = Number.parseInt(String(candidate.finishId ?? ""), 10);
  const imageIds = Array.isArray(candidate.imageIds)
    ? candidate.imageIds.filter(
        (id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0
      )
    : [];

  if (Number.isNaN(productId) || Number.isNaN(finishId) || imageIds.length === 0) {
    return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
  }

  try {
    const product = await query<{ id: number }>(
      "SELECT id FROM products WHERE id = $1",
      [productId]
    );

    if (product.rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const reordered = await reorderProductImages(productId, finishId, imageIds);

    if (!reordered) {
      return NextResponse.json({ error: "Invalid image order" }, { status: 400 });
    }

    const images = await loadProductImages(productId, finishId);

    await logProductImagesReordered({
      adminUserId: auth.user!.id,
      productId,
      finishId,
      imageCount: imageIds.length,
    });

    return NextResponse.json({ images });
  } catch (error) {
    console.error("PATCH /api/admin/product-images failed:", error);
    return NextResponse.json({ error: "Failed to reorder product images" }, { status: 500 });
  }
}
