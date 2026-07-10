import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { mapOrderRows, ORDER_LIST_QUERY } from "@/lib/orders";
import { simulateQuickBooksEstimate } from "@/lib/quickbooks-estimate";
import type { OrderRow } from "@/types/orders";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_view_orders");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const orderId = Number.parseInt(id, 10);

  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  try {
    const result = await query<OrderRow>(
      `
        ${ORDER_LIST_QUERY}
        WHERE o.id = $1
        ORDER BY oi.id ASC
      `,
      [orderId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = mapOrderRows(result.rows, true)[0];
    const estimate = simulateQuickBooksEstimate(order);

    if ("error" in estimate) {
      return NextResponse.json({ error: estimate.error }, { status: estimate.status });
    }

    return NextResponse.json(estimate);
  } catch (error) {
    console.error("POST /api/admin/orders/[id]/quickbooks-estimate failed:", error);
    return NextResponse.json(
      { error: "Failed to simulate QuickBooks estimate" },
      { status: 500 }
    );
  }
}
