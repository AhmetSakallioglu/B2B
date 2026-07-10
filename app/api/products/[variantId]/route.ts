import { NextResponse } from "next/server";
import { mapCatalogRow } from "@/lib/catalog";
import { getSessionUser } from "@/lib/auth";
import {
  canViewCatalogPrices,
  hideCustomerDiscountMetadata,
  redactCatalogProductDetail,
} from "@/lib/catalog-access";
import { getUserDiscountPercent } from "@/lib/customer-tier";
import {
  loadVariantGalleryContext,
  resolveVariantCover,
  resolveVariantGallery,
} from "@/lib/gallery-context";
import { applyCatalogDiscount } from "@/lib/pricing";
import { query } from "@/lib/db";
import type { CatalogProductDetail, CatalogProductRow } from "@/types/catalog";

type RouteContext = {
  params: Promise<{ variantId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { variantId } = await context.params;
  const id = Number.parseInt(variantId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid variant id" }, { status: 400 });
  }

  try {
    const result = await query<CatalogProductRow & { product_id: number }>(
      `
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
        JOIN door_finishes df ON df.id = cp.finish_id
        JOIN products p ON p.id = pv.product_id
        WHERE cp.variant_id = $1 AND df.is_active = true AND p.is_listed = true
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const row = result.rows[0];
    const galleryContext = await loadVariantGalleryContext(id);

    if (!galleryContext) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const mergedImages = resolveVariantGallery(galleryContext);
    const coverImage = resolveVariantCover(galleryContext);
    const sessionUser = await getSessionUser();
    const pricesVisible = canViewCatalogPrices(sessionUser);
    const discountPercent = sessionUser
      ? await getUserDiscountPercent(sessionUser.id, sessionUser.role)
      : 0;

    const mappedProduct = mapCatalogRow(
      { ...row, image_url: coverImage || row.image_url },
      mergedImages
    );
    const pricedProduct = applyCatalogDiscount(mappedProduct, discountPercent);

    const detail: CatalogProductDetail = {
      ...pricedProduct,
      variantSku: row.variant_sku,
      gallerySources: {
        productImages: [...galleryContext.productImages],
        finishImages: [...galleryContext.finishImages],
        variantImages: [...(galleryContext.variantImages ?? [])],
      },
    };

    const product = hideCustomerDiscountMetadata(
      pricesVisible ? detail : redactCatalogProductDetail(detail)
    );

    return NextResponse.json({
      product,
      pricesVisible,
    });
  } catch (error) {
    console.error("GET /api/products/[variantId] failed:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
