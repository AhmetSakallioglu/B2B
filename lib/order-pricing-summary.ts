import { roundCurrency } from "@/lib/pricing";
import type { OrderPricingSummary } from "@/types/orders";

type PricingItem = {
  quantity: number;
  unitPrice: number;
  listUnitPrice: number | null;
};

export function buildOrderPricingSummary(input: {
  items: PricingItem[];
  subtotal: number | null;
  promoDiscount: number;
  totalPrice: number;
  msrpSubtotalSnapshot: number | null;
  tierNameSnapshot: string | null;
  tierDiscountPercentSnapshot: number | null;
  tierDiscountAmountSnapshot: number | null;
  taxRateSnapshot: number | null;
  taxAmountSnapshot: number | null;
  shippingAmountSnapshot: number | null;
  shippingZoneNameSnapshot: string | null;
  shippingPostalCodeSnapshot: string | null;
  promoCode: string | null;
  promoDiscountValue: number | null;
  promoDiscountType: string | null;
  tierNameFallback: string | null;
  tierDiscountPercentFallback: number | null;
}): OrderPricingSummary {
  const msrpFromItems = roundCurrency(
    input.items.reduce(
      (sum, item) => sum + (item.listUnitPrice ?? item.unitPrice) * item.quantity,
      0
    )
  );

  const tierDiscountedSubtotal = roundCurrency(
    input.subtotal ??
      input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  );

  const msrpSubtotal = input.msrpSubtotalSnapshot ?? msrpFromItems;

  const tierDiscountAmount = roundCurrency(
    input.tierDiscountAmountSnapshot ??
      Math.max(0, msrpSubtotal - tierDiscountedSubtotal)
  );

  const tierName = input.tierNameSnapshot ?? input.tierNameFallback ?? "Standard";

  const tierDiscountPercent =
    input.tierDiscountPercentSnapshot ??
    input.tierDiscountPercentFallback ??
    (msrpSubtotal > 0 ? roundCurrency((tierDiscountAmount / msrpSubtotal) * 100) : 0);

  const couponDiscountAmount = roundCurrency(input.promoDiscount);

  let couponDiscountPercent: number | null = null;

  if (input.promoCode && couponDiscountAmount > 0) {
    if (input.promoDiscountType === "percentage" && input.promoDiscountValue !== null) {
      couponDiscountPercent = roundCurrency(input.promoDiscountValue);
    } else if (tierDiscountedSubtotal > 0) {
      couponDiscountPercent = roundCurrency(
        (couponDiscountAmount / tierDiscountedSubtotal) * 100
      );
    }
  }

  const taxableSubtotal = roundCurrency(
    Math.max(0, tierDiscountedSubtotal - couponDiscountAmount)
  );
  const taxRate = input.taxRateSnapshot ?? 0;
  const taxAmount = input.taxAmountSnapshot ?? 0;
  const shippingAmount = roundCurrency(input.shippingAmountSnapshot ?? 0);

  return {
    msrpSubtotal,
    tierName,
    tierDiscountPercent,
    tierDiscountAmount,
    appliedCouponCode: input.promoCode,
    couponDiscountPercent,
    couponDiscountAmount,
    taxableSubtotal,
    taxRate,
    taxAmount,
    shippingAmount,
    shippingZoneName: input.shippingZoneNameSnapshot,
    shippingIsFree: shippingAmount === 0 && (input.shippingZoneNameSnapshot?.length ?? 0) > 0,
    shippingIsOutOfZone: !input.shippingZoneNameSnapshot && shippingAmount > 0,
    shippingNotice: null,
    shippingPostalCode: input.shippingPostalCodeSnapshot,
    totalAmount: roundCurrency(input.totalPrice),
  };
}
