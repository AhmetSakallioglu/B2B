import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { mapOrderRows, ORDER_LIST_QUERY } from "@/lib/orders";
import type { OrderRow } from "@/types/orders";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSession();

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
        WHERE o.id = $1 AND o.user_id = $2
        ORDER BY oi.id ASC
      `,
      [orderId, auth.user!.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = mapOrderRows(result.rows)[0];

    return NextResponse.json({ order });
  } catch (error) {
    console.error("GET /api/orders/[id] failed:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
