import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { mapCatalogRow } from "@/lib/catalog";
import {
  canViewCatalogPrices,
  hideCustomerDiscountMetadataList,
  redactCatalogProducts,
} from "@/lib/catalog-access";
import { getUserDiscountPercent } from "@/lib/customer-tier";
import {
  loadVariantGalleryContexts,
  resolveVariantCover,
  resolveVariantGallery,
} from "@/lib/gallery-context";
import { applyCatalogDiscount } from "@/lib/pricing";
import { query } from "@/lib/db";
import type { CatalogProductRow } from "@/types/catalog";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const finish = searchParams.get("finish")?.trim() ?? "";

    const sessionUser = await getSessionUser();
    const pricesVisible = canViewCatalogPrices(sessionUser);
    const discountPercent = sessionUser
      ? await getUserDiscountPercent(sessionUser.id, sessionUser.role)
      : 0;

    const values: string[] = [];
    const conditions: string[] = [];

    if (finish) {
      values.push(finish);
      conditions.push(`(df.slug = $${values.length} OR df.name = $${values.length})`);
    }

    conditions.push("df.is_active = true");
    conditions.push("df.deleted_at IS NULL");
    conditions.push("p.is_listed = true");

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query<CatalogProductRow & { product_id: number }>(
      `
        SELECT
          pv.product_id,
          cp.finish_id,
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
        ${whereClause}
        ORDER BY cp.category, cp.sub_category, cp.product_sku, cp.variant_sku
      `,
      values
    );

    const variantIds = result.rows.map((row) => row.variant_id);
    const galleryMap = await loadVariantGalleryContexts(variantIds);

    const pricedProducts = result.rows
      .map((row) => {
        const galleryContext = galleryMap.get(row.variant_id);

        const images = galleryContext
          ? resolveVariantGallery(galleryContext)
          : row.image_url
            ? [row.image_url]
            : [];

        const coverImage = galleryContext
          ? resolveVariantCover(galleryContext)
          : row.image_url ?? "";

        const mapped = mapCatalogRow({ ...row, image_url: coverImage || row.image_url }, images);

        return {
          ...mapped,
          gallerySources: galleryContext
            ? {
                productImages: [...galleryContext.productImages],
                finishImages: [...galleryContext.finishImages],
                variantImages: [...(galleryContext.variantImages ?? [])],
              }
            : undefined,
        };
      })
      .map((product) => applyCatalogDiscount(product, discountPercent));

    const products = hideCustomerDiscountMetadataList(
      pricesVisible ? pricedProducts : redactCatalogProducts(pricedProducts)
    );

    return NextResponse.json({
      products,
      pricesVisible,
    });
  } catch (error) {
    console.error("GET /api/products failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
