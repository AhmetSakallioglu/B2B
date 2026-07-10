import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { listPendingTaxExemptionReviews } from "@/lib/tax-exemption";

export async function GET() {
  const auth = await requireAdminPermission("can_approve_tax_exemption");

  if (auth.response) {
    return auth.response;
  }

  try {
    const reviews = await listPendingTaxExemptionReviews();
    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("GET /api/admin/tax-exemptions failed:", error);
    return NextResponse.json({ error: "Failed to load tax exemption reviews" }, { status: 500 });
  }
}
