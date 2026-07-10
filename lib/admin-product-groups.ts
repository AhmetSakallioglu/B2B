import type { AdminProductRow } from "@/types/admin";

export type AdminProductGroup = {
  key: string;
  productId: number;
  productSku: string;
  productName: string;
  isListed: boolean;
  allVariantsOutOfStock: boolean;
  category: string;
  subCategory: string;
  widthIn: string;
  heightIn: string;
  depthIn: string;
  variants: AdminProductRow[];
};

export function areAllVariantsOutOfStock(variants: AdminProductRow[]) {
  return variants.length > 0 && variants.every((variant) => variant.stock_status === "out_of_stock");
}

export function getProductAllVariantsOutOfStock(
  products: AdminProductRow[],
  productId: number
) {
  const variants = products.filter((product) => product.product_id === productId);
  return areAllVariantsOutOfStock(variants);
}

export function buildAdminProductGroupKey(product: AdminProductRow) {
  return `${product.product_sku}|${product.width_in}|${product.height_in}|${product.depth_in}`;
}

export function groupAdminProducts(products: AdminProductRow[]): AdminProductGroup[] {
  const map = new Map<string, AdminProductGroup>();

  for (const product of products) {
    const key = buildAdminProductGroupKey(product);
    const existing = map.get(key);

    if (existing) {
      existing.variants.push(product);
      continue;
    }

    map.set(key, {
      key,
      productId: product.product_id,
      productSku: product.product_sku,
      productName: product.product_name,
      isListed: product.is_listed,
      allVariantsOutOfStock: false,
      category: product.category,
      subCategory: product.sub_category,
      widthIn: product.width_in,
      heightIn: product.height_in,
      depthIn: product.depth_in,
      variants: [product],
    });
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      variants: [...group.variants].sort((a, b) =>
        a.finish_name.localeCompare(b.finish_name)
      ),
      allVariantsOutOfStock: areAllVariantsOutOfStock(group.variants),
    }))
    .sort((a, b) => {
      const skuCompare = a.productSku.localeCompare(b.productSku);
      if (skuCompare !== 0) {
        return skuCompare;
      }

      return Number.parseFloat(a.widthIn) - Number.parseFloat(b.widthIn);
    });
}

export function getAdminProductFinishes(products: AdminProductRow[]) {
  return [...new Set(products.map((product) => product.finish_name))].sort((a, b) =>
    a.localeCompare(b)
  );
}
