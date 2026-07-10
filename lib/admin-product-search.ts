import type { AdminProductRow } from "@/types/admin";

export function filterAdminProducts(
  products: AdminProductRow[],
  query: string,
  category: string,
  subCategory: string,
  stockStatus: string,
  finish: string
) {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    if (category !== "all" && product.category !== category) {
      return false;
    }

    if (subCategory !== "all" && product.sub_category !== subCategory) {
      return false;
    }

    if (stockStatus !== "all" && product.stock_status !== stockStatus) {
      return false;
    }

    if (finish !== "all" && product.finish_name !== finish) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      product.product_name,
      product.product_sku,
      product.variant_sku,
      product.category,
      product.sub_category,
      product.color,
      product.finish_name,
      product.finish_slug,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function getAdminProductCategories(products: AdminProductRow[]) {
  return [...new Set(products.map((product) => product.category))].sort();
}

export function getAdminProductSubCategories(
  products: AdminProductRow[],
  category = "all"
) {
  const scopedProducts =
    category === "all"
      ? products
      : products.filter((product) => product.category === category);

  return [...new Set(scopedProducts.map((product) => product.sub_category))].sort();
}
