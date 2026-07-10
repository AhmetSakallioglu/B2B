import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { getCachedChurnRadarData } from "@/lib/dashboard-analytics-cache";
import { logChurnRecoveryCouponIssued } from "@/lib/churn-recovery-audit";
import { createPromoCodeForUser } from "@/lib/promo-codes";
import { enforceMutationSecurity } from "@/lib/request-security";

export async function POST(request: Request) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  const auth = await requireAdminPermission("can_manage_churn_recovery", request);

  if (auth.response) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userId =
    body && typeof body === "object" && "userId" in body
      ? Number.parseInt(String((body as Record<string, unknown>).userId), 10)
      : Number.NaN;

  const discountValue =
    body && typeof body === "object" && "discountPercent" in body
      ? Number.parseFloat(String((body as Record<string, unknown>).discountPercent))
      : 10;

  const expiryDays =
    body && typeof body === "object" && "expiryDays" in body
      ? Number.parseInt(String((body as Record<string, unknown>).expiryDays), 10)
      : 30;

  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid dealer id" }, { status: 400 });
  }

  if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100) {
    return NextResponse.json({ error: "Discount must be between 0 and 100" }, { status: 400 });
  }

  if (!Number.isFinite(expiryDays) || expiryDays < 1 || expiryDays > 365) {
    return NextResponse.json({ error: "Expiry days must be between 1 and 365" }, { status: 400 });
  }

  try {
    const radar = await getCachedChurnRadarData();
    const dealer = radar.dealers.find((entry) => entry.userId === userId);

    if (!dealer) {
      return NextResponse.json(
        { error: "Dealer is not currently flagged as at-risk VIP" },
        { status: 400 }
      );
    }

    const promo = await createPromoCodeForUser({
      userId,
      discountType: "percentage",
      discountValue,
      expiryDays,
      creationType: "MANUAL",
      source: "manual",
      adminUserId: auth.user!.id,
    });

    await logChurnRecoveryCouponIssued({
      adminUserId: auth.user!.id,
      dealerUserId: userId,
      promoCodeId: promo.id,
      code: promo.code,
      discountPercent: discountValue,
      expiryDays,
      lifetimeValue: dealer.lifetimeValue,
    });

    return NextResponse.json({
      ok: true,
      promo,
      dealer,
    });
  } catch (error) {
    console.error("POST /api/admin/analytics/churn-recovery failed:", error);
    return NextResponse.json({ error: "Failed to issue churn recovery coupon" }, { status: 500 });
  }
}
