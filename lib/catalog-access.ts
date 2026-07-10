import type { SessionUser } from "@/types/auth";
import type { CatalogProduct, CatalogProductDetail } from "@/types/catalog";

export function canViewCatalogPrices(user: SessionUser | null) {
  return user !== null;
}

export function redactCatalogProduct(product: CatalogProduct): CatalogProduct {
  const publicProduct = { ...product };
  delete publicProduct.price;
  delete publicProduct.listPrice;
  return publicProduct;
}

export function redactCatalogProductDetail(
  product: CatalogProductDetail
): CatalogProductDetail {
  return redactCatalogProduct(product) as CatalogProductDetail;
}

export function redactCatalogProducts(products: CatalogProduct[]) {
  return products.map(redactCatalogProduct);
}

export function hideCustomerDiscountMetadata<T extends CatalogProduct>(product: T): T {
  const rest = { ...product };
  delete rest.listPrice;
  return rest as T;
}

export function hideCustomerDiscountMetadataList(products: CatalogProduct[]) {
  return products.map(hideCustomerDiscountMetadata);
}
