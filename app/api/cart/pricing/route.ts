import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { parseCartLineItemsPayload } from "@/lib/cart-items";
import { normalizePromoCodeInput } from "@/lib/promo-codes";
import { rejectClientPricingTampering } from "@/lib/pricing-request-security";
import { resolveServerCartPricing } from "@/lib/server-cart-pricing";
import { normalizeShippingZip } from "@/lib/shipping-zip";

function parsePricingBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const items = parseCartLineItemsPayload(candidate.items);

  if (!items) {
    return null;
  }

  const promoCode =
    candidate.promoCode === undefined || candidate.promoCode === null
      ? null
      : normalizePromoCodeInput(candidate.promoCode);

  if (candidate.promoCode !== undefined && candidate.promoCode !== null && !promoCode) {
    return null;
  }

  const postalCode =
    typeof candidate.postalCode === "string" ? candidate.postalCode.trim() : "";

  return { items, promoCode, postalCode };
}

export async function POST(request: Request) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  if (auth.user!.role === "admin" && !auth.user!.impersonatedBy) {
    return NextResponse.json({ error: "Admin accounts cannot preview cart pricing" }, { status: 403 });
  }

  const rawBody = await request.json();
  const tamper = rejectClientPricingTampering(rawBody);

  if (tamper) {
    return NextResponse.json({ error: tamper.error }, { status: tamper.status });
  }

  const body = parsePricingBody(rawBody);

  if (!body) {
    return NextResponse.json({ error: "Invalid pricing payload" }, { status: 400 });
  }

  if (!normalizeShippingZip(body.postalCode)) {
    return NextResponse.json({ error: "Enter a valid 5-digit delivery ZIP code" }, { status: 400 });
  }

  const pricing = await resolveServerCartPricing({
    items: body.items,
    userId: auth.user!.id,
    userRole: auth.user!.role,
    promoCode: body.promoCode,
    postalCode: body.postalCode,
    requireAvailability: false,
  });

  if ("error" in pricing) {
    return NextResponse.json({ error: pricing.error }, { status: pricing.status });
  }

  return NextResponse.json({ ok: true, pricing });
}
