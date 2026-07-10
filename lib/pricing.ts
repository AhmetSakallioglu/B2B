import type { CustomerTier, CustomerTierRow } from "@/types/customer-tier";

export function applyDiscountPercent(basePrice: number, discountPercent: number) {
  if (discountPercent <= 0) {
    return roundCurrency(basePrice);
  }

  const discounted = basePrice * (1 - discountPercent / 100);
  return roundCurrency(Math.max(discounted, 0));
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function mapCustomerTierRow(row: CustomerTierRow): CustomerTier {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    discountPercent: Number.parseFloat(row.discount_percent),
    description: row.description ?? "",
  };
}

export function applyCatalogDiscount<T extends { price?: number }>(
  product: T,
  discountPercent: number
): T & { listPrice?: number } {
  if (product.price === undefined) {
    return product;
  }

  const listPrice = product.price;

  if (discountPercent <= 0) {
    return { ...product, listPrice };
  }

  return {
    ...product,
    listPrice,
    price: applyDiscountPercent(listPrice, discountPercent),
  };
}
