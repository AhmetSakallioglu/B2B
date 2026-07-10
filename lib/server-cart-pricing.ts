import { CART_UNAVAILABLE_MESSAGE } from "@/lib/cart-validation.constants";
import { getUnavailableVariantIds } from "@/lib/cart-validation";
import { roundQuoteTotal } from "@/lib/cart-items";
import { getUserDiscountPercent, getUserTier } from "@/lib/customer-tier";
import { query } from "@/lib/db";
import { buildCartItemLabel } from "@/lib/format-dimensions";
import { roundCurrency, applyDiscountPercent } from "@/lib/pricing";
import { calculateTexasSalesTax, type DealerTaxStatus } from "@/lib/sales-tax";
import { fetchDealerTaxExemption } from "@/lib/tax-exemption";
import { normalizeShippingZip } from "@/lib/shipping-zip";
import { resolveShippingQuote } from "@/lib/shipping-zones";
import {
  calculatePromoDiscount,
  fetchPromoCodeByCode,
  normalizePromoCodeInput,
  validatePromoCodeForUser,
} from "@/lib/promo-codes";
import type { CartLineInput } from "@/lib/cart-items";
import type { OrderCartItem } from "@/types/catalog";
import type { UserRole } from "@/types/auth";

export type ServerCartPricingError = {
  error: string;
  status: 400 | 403 | 404;
};

export type ServerCartPricingResult = {
  items: OrderCartItem[];
  msrpSubtotal: number;
  subtotal: number;
  tierName: string;
  tierDiscountPercent: number;
  tierDiscountAmount: number;
  promoDiscount: number;
  taxableSubtotal: number;
  taxRate: number;
  taxAmount: number;
  taxExempt: boolean;
  shippingAmount: number;
  shippingZoneId: string | null;
  shippingZoneName: string | null;
  shippingIsFree: boolean;
  shippingIsOutOfZone: boolean;
  shippingNotice: string | null;
  shippingPostalCode: string | null;
  totalAmount: number;
  promoCodeId?: string;
  promoCode?: string;
};

type VariantPricingRow = {
  variant_id: number;
  product_name: string;
  product_sku: string;
  color: string;
  width_in: string;
  height_in: string;
  depth_in: string;
  price: string;
};

function parseVariantIds(items: CartLineInput[]) {
  const variantIds = items.map((item) => Number.parseInt(item.variantId, 10));

  if (variantIds.some((id) => Number.isNaN(id) || id <= 0)) {
    return null;
  }

  return variantIds;
}

export async function resolveServerCartPricing(params: {
  items: CartLineInput[];
  userId: number;
  userRole: UserRole;
  requireAvailability?: boolean;
  promoCode?: string | null;
  postalCode?: string | null;
}): Promise<ServerCartPricingResult | ServerCartPricingError> {
  const requireAvailability = params.requireAvailability ?? true;

  if (params.items.length === 0) {
    return { error: "Cart is empty", status: 400 };
  }

  const variantIds = parseVariantIds(params.items);

  if (!variantIds) {
    return { error: "Invalid variant id in cart", status: 400 };
  }

  const uniqueVariantIds = [...new Set(variantIds)];

  if (requireAvailability) {
    const unavailableVariantIds = await getUnavailableVariantIds(variantIds);

    if (unavailableVariantIds.length > 0) {
      return { error: CART_UNAVAILABLE_MESSAGE, status: 400 };
    }
  }

  const variantRows = await query<VariantPricingRow>(
    `
      SELECT
        pv.id AS variant_id,
        p.name AS product_name,
        p.sku AS product_sku,
        df.name AS color,
        pv.width_in,
        pv.height_in,
        pv.depth_in,
        pv.price
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      JOIN door_finishes df ON df.id = pv.finish_id
      WHERE pv.id = ANY($1::int[])
        AND pv.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND p.is_listed = true
        AND df.deleted_at IS NULL
    `,
    [uniqueVariantIds]
  );

  if (variantRows.rows.length !== uniqueVariantIds.length) {
    return { error: "One or more variants not found", status: 404 };
  }

  const rowMap = new Map(variantRows.rows.map((row) => [row.variant_id, row]));
  const [discountPercent, userTier, taxExemption] = await Promise.all([
    getUserDiscountPercent(params.userId, params.userRole),
    params.userRole === "customer" ? getUserTier(params.userId) : Promise.resolve(null),
    params.userRole === "customer"
      ? fetchDealerTaxExemption(params.userId)
      : Promise.resolve(null),
  ]);
  const taxStatus =
    taxExemption?.taxStatus ?? ("taxable" satisfies DealerTaxStatus);
  const taxExempt = taxExemption?.isTaxExempt ?? false;

  const pricedItems: OrderCartItem[] = [];
  let msrpSubtotal = 0;
  let subtotal = 0;

  for (const item of params.items) {
    const variantId = Number.parseInt(item.variantId, 10);
    const row = rowMap.get(variantId);

    if (!row) {
      return { error: "One or more variants not found", status: 404 };
    }

    const width = Number.parseFloat(row.width_in);
    const height = Number.parseFloat(row.height_in);
    const depth = Number.parseFloat(row.depth_in);
    const listUnitPrice = Number.parseFloat(row.price);
    const unitPrice = applyDiscountPercent(listUnitPrice, discountPercent);

    pricedItems.push({
      id: String(variantId),
      name: buildCartItemLabel(row.product_sku, row.color, width, height, depth),
      width: row.width_in,
      height: row.height_in,
      depth: row.depth_in,
      price: unitPrice,
      quantity: item.quantity,
    });

    msrpSubtotal += listUnitPrice * item.quantity;
    subtotal += unitPrice * item.quantity;
  }

  msrpSubtotal = roundQuoteTotal(msrpSubtotal);
  subtotal = roundQuoteTotal(subtotal);
  const tierDiscountAmount = roundQuoteTotal(Math.max(0, msrpSubtotal - subtotal));
  const tierName = userTier?.name ?? "Standard";
  const tierDiscountPercent = userTier?.discountPercent ?? discountPercent;

  let promoDiscount = 0;
  let promoCodeId: string | undefined;
  let promoCode: string | undefined;

  const normalizedPromoCode = params.promoCode
    ? normalizePromoCodeInput(params.promoCode)
    : null;

  if (normalizedPromoCode) {
    const promo = await fetchPromoCodeByCode(normalizedPromoCode);
    const validation = validatePromoCodeForUser(promo, params.userId);

    if (!validation.ok) {
      return { error: validation.message, status: validation.status };
    }

    promoDiscount = calculatePromoDiscount(
      subtotal,
      validation.promo.discountType,
      validation.promo.discountValue
    );
    promoCodeId = validation.promo.id;
    promoCode = validation.promo.code;
  }

  const discountedSubtotal = roundQuoteTotal(Math.max(0, subtotal - promoDiscount));

  const normalizedPostalCode = params.postalCode
    ? normalizeShippingZip(params.postalCode)
    : null;

  let shippingAmount = 0;
  let shippingZoneId: string | null = null;
  let shippingZoneName: string | null = null;
  let shippingIsFree = false;
  let shippingIsOutOfZone = false;
  let shippingNotice: string | null = null;

  if (normalizedPostalCode) {
    const shippingQuote = await resolveShippingQuote(normalizedPostalCode, discountedSubtotal);

    if ("error" in shippingQuote) {
      return { error: shippingQuote.error, status: 400 };
    }

    shippingAmount = shippingQuote.shippingAmount;
    shippingZoneId = shippingQuote.zoneId;
    shippingZoneName = shippingQuote.zoneName;
    shippingIsFree = shippingQuote.isFreeShipping;
    shippingIsOutOfZone = shippingQuote.isOutOfZone;
    shippingNotice = shippingQuote.notice;
  }

  const taxBase = roundCurrency(Math.max(0, discountedSubtotal + shippingAmount));
  const taxBreakdown = calculateTexasSalesTax(taxBase, taxStatus);

  const totalAmount = taxBreakdown.totalAmount;

  if (totalAmount < 0) {
    return { error: "Invalid cart total", status: 400 };
  }

  return {
    items: pricedItems,
    msrpSubtotal,
    subtotal,
    tierName,
    tierDiscountPercent,
    tierDiscountAmount,
    promoDiscount,
    taxableSubtotal: taxBreakdown.taxableSubtotal,
    taxRate: taxBreakdown.taxRate,
    taxAmount: taxBreakdown.taxAmount,
    taxExempt,
    shippingAmount,
    shippingZoneId,
    shippingZoneName,
    shippingIsFree,
    shippingIsOutOfZone,
    shippingNotice,
    shippingPostalCode: normalizedPostalCode,
    totalAmount,
    ...(promoCodeId ? { promoCodeId, promoCode } : {}),
  };
}
