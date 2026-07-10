import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import {
  getAutomaticCouponsEnabled,
  getPromoExpiryDays,
  listGroupPromoRates,
  updateAutomaticCouponsEnabled,
  updatePromoExpiryDays,
  upsertGroupPromoRates,
} from "@/lib/automation-settings";
import { listDealerGroups, listDealerGroupMembers, listDealersForManualCoupon } from "@/lib/dealer-groups";
import { logCouponSettingsUpdated } from "@/lib/email-audit-log";
import { createPromoCodeForUser, listRecentPromoCodes } from "@/lib/promo-codes";
import { isUserGroupTag, USER_GROUP_TAGS } from "@/types/user-segmentation";

export async function GET() {
  const auth = await requireAnyAdminPermission([
    "can_manage_coupons",
    "can_toggle_coupons",
    "can_delete_coupons",
  ]);

  if (auth.response) {
    return auth.response;
  }

  const [promoCodes, groupRates, customers, dealerGroups, automaticCouponsEnabled, promoExpiryDays] =
    await Promise.all([
    listRecentPromoCodes(),
    listGroupPromoRates(),
    listDealersForManualCoupon(),
    listDealerGroups(),
    getAutomaticCouponsEnabled(),
    getPromoExpiryDays(),
  ]);

  return NextResponse.json({
    promoCodes,
    groupRates,
    customers,
    dealerGroups,
    groupTags: USER_GROUP_TAGS,
    automaticCouponsEnabled,
    promoExpiryDays,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_manage_coupons");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    targetType?: unknown;
    userId?: unknown;
    dealerGroupId?: unknown;
    discountValue?: unknown;
    expiryDays?: unknown;
  };

  const targetType = body.targetType === "group" ? "group" : "dealer";
  const discountValue =
    typeof body.discountValue === "number"
      ? body.discountValue
      : Number.parseFloat(String(body.discountValue ?? ""));

  if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100) {
    return NextResponse.json({ error: "Discount must be between 0 and 100" }, { status: 400 });
  }

  const expiryDays =
    body.expiryDays === undefined || body.expiryDays === null || body.expiryDays === ""
      ? undefined
      : typeof body.expiryDays === "number"
        ? body.expiryDays
        : Number.parseInt(String(body.expiryDays), 10);

  if (
    expiryDays !== undefined &&
    (!Number.isFinite(expiryDays) || expiryDays < 1 || expiryDays > 365)
  ) {
    return NextResponse.json({ error: "Expiry days must be between 1 and 365" }, { status: 400 });
  }

  try {
    if (targetType === "group") {
      const dealerGroupId =
        typeof body.dealerGroupId === "number"
          ? body.dealerGroupId
          : Number.parseInt(String(body.dealerGroupId ?? ""), 10);

      if (!Number.isFinite(dealerGroupId) || dealerGroupId <= 0) {
        return NextResponse.json({ error: "Invalid dealer group" }, { status: 400 });
      }

      const members = await listDealerGroupMembers(dealerGroupId);

      if (members.length === 0) {
        return NextResponse.json(
          { error: "Selected group has no members. Add dealers under Recipient groups first." },
          { status: 400 }
        );
      }

      const promos = [];
      const errors: string[] = [];

      for (const member of members) {
        try {
          const promo = await createPromoCodeForUser({
            userId: member.userId,
            discountType: "percentage",
            discountValue,
            expiryDays,
            creationType: "MANUAL",
            source: "manual",
            adminUserId: auth.user!.id,
          });
          promos.push(promo);
        } catch (error) {
          errors.push(
            `${member.email}: ${error instanceof Error ? error.message : "Failed to create promo code"}`
          );
        }
      }

      if (promos.length === 0) {
        return NextResponse.json(
          { error: errors[0] ?? "Failed to create promo codes for group" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          targetType: "group",
          created: promos.length,
          failed: errors.length,
          promos,
          errors,
        },
        { status: 201 }
      );
    }

    const userId =
      typeof body.userId === "number"
        ? body.userId
        : Number.parseInt(String(body.userId ?? ""), 10);

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
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

    return NextResponse.json(
      {
        ok: true,
        targetType: "dealer",
        created: 1,
        failed: 0,
        promo,
        promos: [promo],
        errors: [],
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create promo code" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminPermission("can_manage_coupons");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    groupRates?: Array<{
      groupTag?: unknown;
      discountPercentage?: unknown;
      isActive?: unknown;
    }>;
    automaticCouponsEnabled?: unknown;
    promoExpiryDays?: unknown;
  };

  const changes: Record<string, unknown> = {};

  if (typeof body.automaticCouponsEnabled === "boolean") {
    await updateAutomaticCouponsEnabled(body.automaticCouponsEnabled);
    changes.automatic_coupons_enabled = body.automaticCouponsEnabled;
  }

  if (body.promoExpiryDays !== undefined && body.promoExpiryDays !== null) {
    const promoExpiryDays =
      typeof body.promoExpiryDays === "number"
        ? body.promoExpiryDays
        : Number.parseInt(String(body.promoExpiryDays), 10);

    try {
      await updatePromoExpiryDays(promoExpiryDays);
      changes.promo_expiry_days = promoExpiryDays;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid expiry days" },
        { status: 400 }
      );
    }
  }

  if (Array.isArray(body.groupRates)) {
    const parsed = [];

    for (const entry of body.groupRates) {
      const groupTag = typeof entry.groupTag === "string" ? entry.groupTag.trim() : "";
      const discountPercentage =
        typeof entry.discountPercentage === "number"
          ? entry.discountPercentage
          : Number.parseFloat(String(entry.discountPercentage ?? ""));
      const isActive =
        typeof entry.isActive === "boolean" ? entry.isActive : undefined;

      if (!isUserGroupTag(groupTag)) {
        return NextResponse.json({ error: `Invalid group tag: ${groupTag}` }, { status: 400 });
      }

      if (
        !Number.isFinite(discountPercentage) ||
        discountPercentage < 0 ||
        discountPercentage > 100
      ) {
        return NextResponse.json({ error: "Invalid discount percentage" }, { status: 400 });
      }

      parsed.push({ groupTag, discountPercentage, isActive });
    }

    await upsertGroupPromoRates(parsed);
    changes.group_rates = parsed;
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "No coupon settings to update" }, { status: 400 });
  }

  try {
    const [groupRates, automaticCouponsEnabled, promoExpiryDays] = await Promise.all([
      listGroupPromoRates(),
      getAutomaticCouponsEnabled(),
      getPromoExpiryDays(),
    ]);

    await logCouponSettingsUpdated({
      adminUserId: auth.user!.id,
      changes,
    });

    return NextResponse.json({ ok: true, groupRates, automaticCouponsEnabled, promoExpiryDays });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update group rates" },
      { status: 400 }
    );
  }
}
