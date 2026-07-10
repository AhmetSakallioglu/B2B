import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { parseCartLineItemsPayload } from "@/lib/cart-items";
import { roundQuoteTotal } from "@/lib/cart-items";
import { normalizePromoCodeInput } from "@/lib/promo-codes";
import { resolveServerCartPricing } from "@/lib/server-cart-pricing";
import { resolveShippingQuote } from "@/lib/shipping-zones";
import { normalizeShippingZip } from "@/lib/shipping-zip";

export async function POST(request: Request) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  if (auth.user!.role === "admin" && !auth.user!.impersonatedBy) {
    return NextResponse.json({ error: "Admin accounts cannot calculate shipping" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const zipCode = typeof body.zipCode === "string" ? body.zipCode.trim() : "";
  const normalizedZip = normalizeShippingZip(zipCode);

  if (!normalizedZip) {
    return NextResponse.json({ error: "Enter a valid 5-digit ZIP code" }, { status: 400 });
  }

  let merchandiseSubtotal =
    typeof body.merchandiseSubtotal === "number"
      ? body.merchandiseSubtotal
      : Number.parseFloat(String(body.merchandiseSubtotal ?? ""));

  const items = parseCartLineItemsPayload(body.items);
  const promoCode =
    body.promoCode === undefined || body.promoCode === null
      ? null
      : normalizePromoCodeInput(body.promoCode);

  if (items && items.length > 0) {
    const pricing = await resolveServerCartPricing({
      items,
      userId: auth.user!.id,
      userRole: auth.user!.role,
      promoCode,
      postalCode: normalizedZip,
      requireAvailability: false,
    });

    if ("error" in pricing) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status });
    }

    return NextResponse.json({
      ok: true,
      zipCode: normalizedZip,
      merchandiseSubtotal: pricing.taxableSubtotal,
      shipping: {
        zoneId: pricing.shippingZoneId,
        zoneName: pricing.shippingZoneName,
        amount: pricing.shippingAmount,
        isFreeShipping: pricing.shippingIsFree,
        isOutOfZone: pricing.shippingIsOutOfZone,
        notice: pricing.shippingNotice,
      },
      pricing,
    });
  }

  if (!Number.isFinite(merchandiseSubtotal) || merchandiseSubtotal < 0) {
    return NextResponse.json({ error: "Merchandise subtotal is required" }, { status: 400 });
  }

  merchandiseSubtotal = roundQuoteTotal(merchandiseSubtotal);
  const shippingResult = await resolveShippingQuote(normalizedZip, merchandiseSubtotal);

  if ("error" in shippingResult) {
    return NextResponse.json({ error: shippingResult.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    zipCode: normalizedZip,
    merchandiseSubtotal,
    shipping: {
      zoneId: shippingResult.zoneId,
      zoneName: shippingResult.zoneName,
      amount: shippingResult.shippingAmount,
      isFreeShipping: shippingResult.isFreeShipping,
      isOutOfZone: shippingResult.isOutOfZone,
      notice: shippingResult.notice,
    },
  });
}
