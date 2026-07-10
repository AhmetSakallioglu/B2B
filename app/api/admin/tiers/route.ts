import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import { logTierCreate } from "@/lib/admin-audit-log";
import { parseUpsertCustomerTierBody } from "@/lib/admin-users";
import { getCustomerTiers } from "@/lib/customer-tier";
import { query } from "@/lib/db";
import { mapCustomerTierRow } from "@/lib/pricing";
import type { CustomerTierRow } from "@/types/customer-tier";

export async function GET() {
  const auth = await requireAnyAdminPermission([
    "can_add_tiers",
    "can_delete_tiers",
    "can_edit_tiers",
  ]);

  if (auth.response) {
    return auth.response;
  }

  try {
    const tiers = await getCustomerTiers();
    return NextResponse.json({ tiers });
  } catch (error) {
    console.error("GET /api/admin/tiers failed:", error);
    return NextResponse.json({ error: "Failed to fetch tiers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_add_tiers");

  if (auth.response) {
    return auth.response;
  }

  const body = parseUpsertCustomerTierBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid tier payload" }, { status: 400 });
  }

  try {
    const result = await query<CustomerTierRow>(
      `
        INSERT INTO customer_tiers (name, level, discount_percent, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, level, discount_percent, description
      `,
      [body.name, body.level, body.discountPercent, body.description || null]
    );

    const tierRow = result.rows[0];

    await logTierCreate({
      adminUserId: auth.user!.id,
      tier: {
        id: tierRow.id,
        name: tierRow.name,
        level: tierRow.level,
        discount_percent: Number.parseFloat(tierRow.discount_percent),
        description: tierRow.description,
      },
    });

    return NextResponse.json(
      { tier: mapCustomerTierRow(tierRow) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "A tier with this level already exists" },
        { status: 409 }
      );
    }

    console.error("POST /api/admin/tiers failed:", error);
    return NextResponse.json({ error: "Failed to create tier" }, { status: 500 });
  }
}
