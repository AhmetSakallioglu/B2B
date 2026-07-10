import { roundCurrency } from "@/lib/pricing";
import type { ServerCartPricingResult } from "@/lib/server-cart-pricing";

/**
 * Converts an authoritative server-side checkout total to Stripe integer cents.
 * Never pass client-supplied amounts into Stripe.
 */
export function pricingTotalToStripeCents(pricing: ServerCartPricingResult) {
  const normalizedTotal = roundCurrency(pricing.totalAmount);

  if (!Number.isFinite(normalizedTotal) || normalizedTotal <= 0) {
    throw new Error("Checkout total must be a positive server-calculated amount");
  }

  return Math.round(normalizedTotal * 100);
}

/**
 * Builds the amount metadata for a Stripe PaymentIntent from server pricing only.
 * Wire this when STRIPE_SECRET_KEY is configured; until then orders use POST /api/orders.
 */
export function buildStripePaymentIntentPayload(params: {
  pricing: ServerCartPricingResult;
  userId: number;
  orderId?: number;
}) {
  return {
    amount: pricingTotalToStripeCents(params.pricing),
    currency: "usd" as const,
    metadata: {
      userId: String(params.userId),
      ...(params.orderId ? { orderId: String(params.orderId) } : {}),
      msrpSubtotal: String(params.pricing.msrpSubtotal),
      subtotal: String(params.pricing.subtotal),
      promoDiscount: String(params.pricing.promoDiscount),
      shippingAmount: String(params.pricing.shippingAmount),
      taxAmount: String(params.pricing.taxAmount),
      totalAmount: String(params.pricing.totalAmount),
    },
  };
}
