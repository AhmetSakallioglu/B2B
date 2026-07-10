import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { listOrderCustomerSummaries } from "@/lib/order-customer-analytics";

export async function GET() {
  const auth = await requireAdminPermission("can_view_orders");

  if (auth.response) {
    return auth.response;
  }

  try {
    const customers = await listOrderCustomerSummaries();

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("GET /api/admin/orders/customer-summary failed:", error);
    return NextResponse.json(
      { error: "Failed to load order customer summary" },
      { status: 500 }
    );
  }
}
