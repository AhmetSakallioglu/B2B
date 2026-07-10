import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  logPromoCodeDeleted,
  logPromoCodeStatusChanged,
} from "@/lib/promo-code-audit-log";
import {
  deletePromoCodeRecord,
  getPromoCodeById,
  setPromoCodeActive,
} from "@/lib/promo-codes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_toggle_coupons");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = (await request.json()) as { isActive?: unknown };

  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "Invalid active state" }, { status: 400 });
  }

  try {
    const existing = await getPromoCodeById(id);

    if (!existing) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
    }

    if (existing.isActive === body.isActive) {
      return NextResponse.json({ promo: existing });
    }

    const promo = await setPromoCodeActive(id, body.isActive);

    await logPromoCodeStatusChanged({
      adminUserId: auth.user!.id,
      dealerUserId: existing.userId,
      promoCodeId: existing.id,
      code: existing.code,
      isActive: body.isActive,
    });

    return NextResponse.json({
      promo: {
        ...promo,
        userEmail: existing.userEmail,
        companyName: existing.companyName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update promo code" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_delete_coupons");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const deleted = await deletePromoCodeRecord(id);

    await logPromoCodeDeleted({
      adminUserId: auth.user!.id,
      dealerUserId: deleted.userId,
      promoCodeId: deleted.id,
      code: deleted.code,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete promo code";
    const status = message === "Promo code not found" ? 404 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
