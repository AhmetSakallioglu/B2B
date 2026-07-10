import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { logOrderStatusChange } from "@/lib/order-audit-log";
import { mapOrderRows, ORDER_LIST_QUERY } from "@/lib/orders";
import { parseOrderStatusUpdate } from "@/lib/order-status";
import type { OrderRow } from "@/types/orders";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
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

    return NextResponse.json({ order });
  } catch (error) {
    console.error("GET /api/admin/orders/[id] failed:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_change_order_status");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const orderId = Number.parseInt(id, 10);

  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const status = parseOrderStatusUpdate(await request.json());

  if (!status) {
    return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
  }

  try {
    const existing = await query<{
      status: string;
      company_name: string | null;
      contact_name: string | null;
      email: string;
    }>(
      `
        SELECT o.status, u.company_name, u.contact_name, u.email
        FROM orders o
        INNER JOIN users u ON u.id = o.user_id
        WHERE o.id = $1
      `,
      [orderId]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const before = existing.rows[0];

    if (before.status === status) {
      const result = await query<OrderRow>(
        `
          ${ORDER_LIST_QUERY}
          WHERE o.id = $1
          ORDER BY oi.id ASC
        `,
        [orderId]
      );

      const order = mapOrderRows(result.rows, true)[0];

      return NextResponse.json({ order, status });
    }

    await query(
      `
        UPDATE orders
        SET status = $1
        WHERE id = $2
      `,
      [status, orderId]
    );

    const dealerLabel =
      before.company_name || before.contact_name || before.email;

    await logOrderStatusChange({
      adminUserId: auth.user!.id,
      orderId,
      oldStatus: before.status,
      newStatus: status,
      dealerLabel,
    });

    const result = await query<OrderRow>(
      `
        ${ORDER_LIST_QUERY}
        WHERE o.id = $1
        ORDER BY oi.id ASC
      `,
      [orderId]
    );

    const order = mapOrderRows(result.rows, true)[0];

    return NextResponse.json({ order, status });
  } catch (error) {
    console.error("PATCH /api/admin/orders/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }
}
