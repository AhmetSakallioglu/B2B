import type { CatalogProduct, CatalogProductRow, StockStatus } from "@/types/catalog";

function formatDimension(value: string | number) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  return `${numeric}"`;
}

export function formatStockStatus(status: CatalogProductRow["stock_status"]): StockStatus {
  return status === "in_stock" ? "In Stock" : "Out of Stock";
}

export function mapCatalogRow(
  row: CatalogProductRow,
  images: string[] = row.image_url ? [row.image_url] : []
): CatalogProduct {
  const coverImage = row.image_url ?? images[0] ?? "";

  return {
    id: String(row.variant_id),
    productSku: row.product_sku,
    name: row.product_name,
    description: row.description ?? "",
    category: row.category,
    categorySlug: row.category_slug,
    subCategory: row.sub_category,
    subCategorySlug: row.sub_category_slug,
    width: formatDimension(row.width_in),
    height: formatDimension(row.height_in),
    depth: formatDimension(row.depth_in),
    color: row.color,
    finishSlug: row.finish_slug,
    stockStatus: formatStockStatus(row.stock_status),
    price: Number.parseFloat(row.price),
    image: coverImage,
    images: images.length > 0 ? images : coverImage ? [coverImage] : [],
  };
}
