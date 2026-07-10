import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  getCartAppliedPromo,
  isPromoAlreadyAppliedToCart,
  saveCartAppliedPromo,
} from "@/lib/cart-applied-promo";
import { getUserDiscountPercent } from "@/lib/customer-tier";
import { loadUserCartItems } from "@/lib/cart";
import {
  fetchPromoCodeByCode,
  normalizePromoCodeInput,
  recordPromoCodeApplied,
} from "@/lib/promo-codes";
import { rejectClientPricingTampering } from "@/lib/pricing-request-security";
import { resolveServerCartPricing } from "@/lib/server-cart-pricing";
import type { AppliedPromoSummary } from "@/types/promo-code";

const COUPON_ALREADY_APPLIED_MESSAGE = "This coupon has already been applied to your cart";

function parseApplyCouponBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const code = normalizePromoCodeInput(candidate.code);

  if (!code) {
    return null;
  }

  return { code };
}

export async function POST(request: Request) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  if (auth.user!.role === "admin") {
    return NextResponse.json({ error: "Admin accounts cannot apply promo codes" }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const tamper = rejectClientPricingTampering(body);

  if (tamper) {
    return NextResponse.json({ error: tamper.error }, { status: tamper.status });
  }

  const parsed = parseApplyCouponBody(body);

  if (!parsed) {
    return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
  }

  try {
    const alreadyApplied = await isPromoAlreadyAppliedToCart(auth.user!.id, parsed.code);

    if (alreadyApplied) {
      return NextResponse.json({ error: COUPON_ALREADY_APPLIED_MESSAGE }, { status: 400 });
    }

    const discountPercent = await getUserDiscountPercent(auth.user!.id, auth.user!.role);
    const cartItems = await loadUserCartItems(auth.user!.id, discountPercent);

    if (cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const lineItems = cartItems.map((item) => ({
      variantId: item.id,
      quantity: item.quantity,
    }));

    const pricing = await resolveServerCartPricing({
      items: lineItems,
      userId: auth.user!.id,
      userRole: auth.user!.role,
      promoCode: parsed.code,
    });

    if ("error" in pricing) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status });
    }

    if (!pricing.promoCode || !pricing.promoCodeId) {
      return NextResponse.json({ error: "Invalid or unauthorized coupon code" }, { status: 403 });
    }

    const promoRecord = await fetchPromoCodeByCode(pricing.promoCode);

    if (!promoRecord) {
      return NextResponse.json({ error: "Invalid or unauthorized coupon code" }, { status: 403 });
    }

    const existingApplied = await getCartAppliedPromo(auth.user!.id);

    if (existingApplied && existingApplied.code.toUpperCase() === parsed.code.toUpperCase()) {
      return NextResponse.json({ error: COUPON_ALREADY_APPLIED_MESSAGE }, { status: 400 });
    }

    await saveCartAppliedPromo({
      userId: auth.user!.id,
      promoCodeId: pricing.promoCodeId,
      code: pricing.promoCode,
      promoDiscount: pricing.promoDiscount,
      subtotal: pricing.subtotal,
    });

    const applied: AppliedPromoSummary = {
      code: pricing.promoCode,
      discountType: promoRecord.discountType,
      discountValue: promoRecord.discountValue,
      subtotal: pricing.subtotal,
      promoDiscount: pricing.promoDiscount,
      taxableSubtotal: pricing.taxableSubtotal,
      taxRate: pricing.taxRate,
      taxAmount: pricing.taxAmount,
      totalAmount: pricing.totalAmount,
      expiresAt: promoRecord.expiresAt,
    };

    await recordPromoCodeApplied({
      userId: auth.user!.id,
      code: applied.code,
      promoDiscount: applied.promoDiscount,
      subtotal: applied.subtotal,
    });

    return NextResponse.json({ ok: true, promo: applied });
  } catch (error) {
    console.error("POST /api/cart/apply-coupon failed:", error);
    return NextResponse.json({ error: "Failed to apply promo code" }, { status: 500 });
  }
}
