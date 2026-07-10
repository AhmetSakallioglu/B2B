import { getCartAppliedPromo } from "@/lib/cart-applied-promo";
import { CART_UNAVAILABLE_MESSAGE } from "@/lib/cart-validation.constants";
import { roundQuoteTotal } from "@/lib/cart-items";
import type { CartLineInput } from "@/lib/cart-items";
import { query } from "@/lib/db";
import { roundCurrency } from "@/lib/pricing";
import { resolveServerCartPricing } from "@/lib/server-cart-pricing";
import { calculateTexasSalesTax } from "@/lib/sales-tax";
import { normalizeShippingZip } from "@/lib/shipping-zip";
import { resolveShippingQuote } from "@/lib/shipping-zones";
import type { UserRole } from "@/types/auth";
import type {
  ClientQuoteLineItem,
  ClientQuotePricingResult,
} from "@/types/client-quotes";

type VariantDetailRow = {
  variant_id: number;
  product_sku: string;
  variant_sku: string;
  color: string;
  width_in: string;
  height_in: string;
  depth_in: string;
};

export type ClientQuotePricingError = {
  error: string;
  status: 400 | 403 | 404;
};

function applyMarkup(dealerNetUnitPrice: number, markupPercentage: number) {
  return roundCurrency(dealerNetUnitPrice * (1 + markupPercentage / 100));
}

function allocatePromoShare(
  lineTierTotal: number,
  subtotal: number,
  promoDiscount: number,
  isLastLine: boolean,
  remainingPromo: { value: number }
) {
  if (promoDiscount <= 0 || subtotal <= 0) {
    return 0;
  }

  if (isLastLine) {
    const share = remainingPromo.value;
    remainingPromo.value = 0;
    return share;
  }

  const share = roundCurrency((lineTierTotal / subtotal) * promoDiscount);
  remainingPromo.value = roundCurrency(remainingPromo.value - share);
  return share;
}

export async function resolveClientQuotePricing(params: {
  items: CartLineInput[];
  userId: number;
  userRole: UserRole;
  markupPercentage: number;
  includeTax: boolean;
  includeShipping: boolean;
  shippingPostalCode?: string | null;
  promoCode?: string | null;
}): Promise<ClientQuotePricingResult | ClientQuotePricingError> {
  if (params.items.length === 0) {
    return { error: "Cart is empty", status: 400 };
  }

  const appliedPromo = await getCartAppliedPromo(params.userId);
  const promoCode = params.promoCode ?? appliedPromo?.code ?? null;

  const serverPricing = await resolveServerCartPricing({
    items: params.items,
    userId: params.userId,
    userRole: params.userRole,
    promoCode,
    requireAvailability: true,
  });

  if ("error" in serverPricing) {
    return { error: serverPricing.error, status: serverPricing.status };
  }

  if (serverPricing.items.length === 0) {
    return { error: CART_UNAVAILABLE_MESSAGE, status: 400 };
  }

  const variantIds = serverPricing.items.map((item) => Number.parseInt(item.id, 10));
  const variantRows = await query<VariantDetailRow>(
    `
      SELECT
        pv.id AS variant_id,
        p.sku AS product_sku,
        pv.sku AS variant_sku,
        df.name AS color,
        pv.width_in,
        pv.height_in,
        pv.depth_in
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      JOIN door_finishes df ON df.id = pv.finish_id
      WHERE pv.id = ANY($1::int[])
    `,
    [variantIds]
  );

  const detailMap = new Map(variantRows.rows.map((row) => [row.variant_id, row]));
  const lineItems: ClientQuoteLineItem[] = [];
  const remainingPromo = { value: serverPricing.promoDiscount };
  let dealerNetSubtotal = 0;
  let clientSubtotal = 0;

  for (const [index, item] of serverPricing.items.entries()) {
    const variantId = Number.parseInt(item.id, 10);
    const detail = detailMap.get(variantId);

    if (!detail) {
      return { error: "One or more variants not found", status: 404 };
    }

    const tierUnitPrice = item.price;
    const tierLineTotal = roundCurrency(tierUnitPrice * item.quantity);
    const promoShare = allocatePromoShare(
      tierLineTotal,
      serverPricing.subtotal,
      serverPricing.promoDiscount,
      index === serverPricing.items.length - 1,
      remainingPromo
    );
    const netLineTotal = roundCurrency(Math.max(0, tierLineTotal - promoShare));
    const dealerNetUnitPrice = roundCurrency(netLineTotal / item.quantity);
    const clientUnitPrice = applyMarkup(dealerNetUnitPrice, params.markupPercentage);
    const lineTotal = roundCurrency(clientUnitPrice * item.quantity);

    lineItems.push({
      variantId: item.id,
      productSku: detail.product_sku,
      variantSku: detail.variant_sku,
      color: detail.color,
      width: detail.width_in,
      height: detail.height_in,
      depth: detail.depth_in,
      quantity: item.quantity,
      dealerNetUnitPrice,
      clientUnitPrice,
      lineTotal,
    });

    dealerNetSubtotal += netLineTotal;
    clientSubtotal += lineTotal;
  }

  dealerNetSubtotal = roundQuoteTotal(dealerNetSubtotal);
  clientSubtotal = roundQuoteTotal(clientSubtotal);

  let shippingAmount = 0;
  let shippingIsFree = false;
  let shippingNotice: string | null = null;

  if (params.includeShipping) {
    const normalizedPostalCode = params.shippingPostalCode
      ? normalizeShippingZip(params.shippingPostalCode)
      : null;

    if (!normalizedPostalCode) {
      return {
        error: "Select a saved shipping address to include delivery on the quote",
        status: 400,
      };
    }

    const shippingQuote = await resolveShippingQuote(normalizedPostalCode, dealerNetSubtotal);

    if ("error" in shippingQuote) {
      return { error: shippingQuote.error, status: 400 };
    }

    shippingAmount = shippingQuote.shippingAmount;
    shippingIsFree = shippingQuote.isFreeShipping;
    shippingNotice = shippingQuote.notice;
  }

  let taxRate = 0;
  let taxAmount = 0;

  if (params.includeTax) {
    const taxableBase = roundCurrency(
      clientSubtotal + (params.includeShipping ? shippingAmount : 0)
    );
    const taxBreakdown = calculateTexasSalesTax(taxableBase, "taxable");
    taxRate = taxBreakdown.taxRate;
    taxAmount = taxBreakdown.taxAmount;
  }

  const totalAmount = roundQuoteTotal(
    clientSubtotal + (params.includeShipping ? shippingAmount : 0) + taxAmount
  );

  return {
    items: lineItems,
    dealerNetSubtotal,
    clientSubtotal,
    markupPercentage: params.markupPercentage,
    taxRate,
    taxAmount,
    shippingAmount,
    shippingIsFree,
    shippingNotice,
    totalAmount,
    includeTax: params.includeTax,
    includeShipping: params.includeShipping,
  };
}

export function buildClientQuoteDisclaimer(pricing: Pick<
  ClientQuotePricingResult,
  "includeTax" | "includeShipping"
>) {
  if (!pricing.includeTax && !pricing.includeShipping) {
    return "Taxes and delivery not included.";
  }

  if (!pricing.includeTax) {
    return "Taxes not included.";
  }

  if (!pricing.includeShipping) {
    return "Delivery not included.";
  }

  return null;
}
