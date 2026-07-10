import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  fetchTierAuditSnapshot,
  logTierDelete,
  logTierUpdate,
} from "@/lib/admin-audit-log";
import { parseUpsertCustomerTierBody } from "@/lib/admin-users";
import { query } from "@/lib/db";
import { mapCustomerTierRow } from "@/lib/pricing";
import type { CustomerTierRow } from "@/types/customer-tier";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_edit_tiers");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const tierId = Number.parseInt(id, 10);

  if (Number.isNaN(tierId)) {
    return NextResponse.json({ error: "Invalid tier id" }, { status: 400 });
  }

  const body = parseUpsertCustomerTierBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid tier payload" }, { status: 400 });
  }

  try {
    const existing = await fetchTierAuditSnapshot(tierId);

    if (!existing) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    const result = await query<CustomerTierRow>(
      `
        UPDATE customer_tiers
        SET
          name = $2,
          level = $3,
          discount_percent = $4,
          description = $5,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, level, discount_percent, description
      `,
      [tierId, body.name, body.level, body.discountPercent, body.description || null]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    const updated = result.rows[0];

    await logTierUpdate({
      adminUserId: auth.user!.id,
      tierId,
      oldTier: existing,
      newTier: {
        id: updated.id,
        name: updated.name,
        level: updated.level,
        discount_percent: Number.parseFloat(updated.discount_percent),
        description: updated.description,
      },
    });

    return NextResponse.json({ tier: mapCustomerTierRow(updated) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "A tier with this level already exists" },
        { status: 409 }
      );
    }

    console.error("PATCH /api/admin/tiers/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_delete_tiers");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const tierId = Number.parseInt(id, 10);

  if (Number.isNaN(tierId)) {
    return NextResponse.json({ error: "Invalid tier id" }, { status: 400 });
  }

  try {
    const existing = await fetchTierAuditSnapshot(tierId);

    if (!existing) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    const result = await query<{ id: number }>(
      "DELETE FROM customer_tiers WHERE id = $1 RETURNING id",
      [tierId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    await logTierDelete({
      adminUserId: auth.user!.id,
      tier: existing,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/tiers/[id] failed:", error);
    return NextResponse.json({ error: "Failed to delete tier" }, { status: 500 });
  }
}
