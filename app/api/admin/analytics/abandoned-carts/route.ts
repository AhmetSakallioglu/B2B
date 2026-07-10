import { NextResponse } from "next/server";
import { getAbandonedCartAnalytics } from "@/lib/abandoned-cart-analytics";
import { requireAdminPermission } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdminPermission("can_view_orders");

  if (auth.response) {
    return auth.response;
  }

  try {
    const analytics = await getAbandonedCartAnalytics();
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("GET /api/admin/analytics/abandoned-carts failed:", error);
    return NextResponse.json(
      { error: "Failed to load abandoned cart analytics" },
      { status: 500 }
    );
  }
}
