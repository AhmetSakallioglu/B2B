import { getUserDiscountPercent } from "@/lib/customer-tier";
import { query } from "@/lib/db";
import { roundCurrency, applyDiscountPercent } from "@/lib/pricing";
import { calculateTexasSalesTax } from "@/lib/sales-tax";
import { fetchDealerTaxExemption } from "@/lib/tax-exemption";
import type { OrderCartSnapshotItem } from "@/types/order-modification";

export type ResolvedModificationLine = {
  variantId: number;
  quantity: number;
  unitPrice: number;
  variantSku: string;
  productSku: string;
  productName: string;
  color: string;
};

type VariantLookupRow = {
  variant_id: number;
  variant_sku: string;
  product_sku: string;
  product_name: string;
  color: string;
  price: string;
};

export async function lookupVariantBySku(variantSku: string) {
  const result = await query<VariantLookupRow>(
    `
      SELECT
        cp.variant_id,
        cp.variant_sku,
        cp.product_sku,
        cp.product_name,
        cp.color,
        pv.price
      FROM catalog_products cp
      JOIN product_variants pv ON pv.id = cp.variant_id
      WHERE UPPER(cp.variant_sku) = UPPER($1)
        AND pv.deleted_at IS NULL
      LIMIT 1
    `,
    [variantSku]
  );

  return result.rows[0] ?? null;
}

export async function priceNewModificationLine(params: {
  variantId: number;
  quantity: number;
  dealerUserId: number;
}) {
  const row = await query<VariantLookupRow>(
    `
      SELECT
        cp.variant_id,
        cp.variant_sku,
        cp.product_sku,
        cp.product_name,
        cp.color,
        pv.price
      FROM catalog_products cp
      JOIN product_variants pv ON pv.id = cp.variant_id
      WHERE cp.variant_id = $1
        AND pv.deleted_at IS NULL
      LIMIT 1
    `,
    [params.variantId]
  );

  if (row.rows.length === 0) {
    return null;
  }

  const variant = row.rows[0];
  const discountPercent = await getUserDiscountPercent(params.dealerUserId, "customer");
  const listUnitPrice = Number.parseFloat(variant.price);
  const unitPrice = applyDiscountPercent(listUnitPrice, discountPercent);

  return {
    variantId: variant.variant_id,
    quantity: params.quantity,
    unitPrice,
    variantSku: variant.variant_sku,
    productSku: variant.product_sku,
    productName: variant.product_name,
    color: variant.color,
  } satisfies ResolvedModificationLine;
}

export function buildCartSnapshotFromLines(
  lines: ResolvedModificationLine[],
  existingItemIds: Map<number, number>
): OrderCartSnapshotItem[] {
  return lines.map((line, index) => ({
    itemId: existingItemIds.get(line.variantId) ?? -(index + 1),
    variantId: line.variantId,
    variantSku: line.variantSku,
    productSku: line.productSku,
    productName: line.productName,
    color: line.color,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }));
}

export function calculateModifiedOrderTotals(params: {
  lines: ResolvedModificationLine[];
  promoDiscount: number;
  shippingAmount: number;
  taxStatus: "taxable" | "exempt";
}) {
  const subtotal = roundCurrency(
    params.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  );
  const discountedSubtotal = roundCurrency(Math.max(0, subtotal - params.promoDiscount));
  const taxBase = roundCurrency(discountedSubtotal + params.shippingAmount);
  const taxBreakdown = calculateTexasSalesTax(taxBase, params.taxStatus);

  return {
    subtotal,
    promoDiscount: params.promoDiscount,
    taxableSubtotal: taxBreakdown.taxableSubtotal,
    taxRate: taxBreakdown.taxRate,
    taxAmount: taxBreakdown.taxAmount,
    shippingAmount: params.shippingAmount,
    totalAmount: taxBreakdown.totalAmount,
  };
}

export async function resolveDealerTaxStatusForModification(dealerUserId: number) {
  const exemption = await fetchDealerTaxExemption(dealerUserId);
  return exemption?.taxStatus ?? ("taxable" as const);
}
