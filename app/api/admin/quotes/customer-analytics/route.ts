import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { listQuoteCustomerAnalytics } from "@/lib/quote-analytics";

export async function GET() {
  const auth = await requireAdminPermission("can_manage_quotes");

  if (auth.response) {
    return auth.response;
  }

  try {
    const customers = await listQuoteCustomerAnalytics();

    return NextResponse.json({
      customers,
      hotLeadCount: customers.filter((customer) => customer.isHotLead).length,
    });
  } catch (error) {
    console.error("GET /api/admin/quotes/customer-analytics failed:", error);
    return NextResponse.json(
      { error: "Failed to load quote customer analytics" },
      { status: 500 }
    );
  }
}
