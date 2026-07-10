import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { parseSanitizedAdminOrdersListQuery } from "@/lib/admin-search-sanitization";
import { query } from "@/lib/db";
import { mapOrderRows, ORDER_LIST_QUERY } from "@/lib/orders";
import type { OrderRow } from "@/types/orders";

export async function GET(request: Request) {
  const auth = await requireAdminPermission("can_view_orders");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const parsed = await parseSanitizedAdminOrdersListQuery(
    request,
    searchParams,
    auth.user!.id
  );

  if (parsed.blocked) {
    return parsed.blocked;
  }

  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (parsed.userId) {
    values.push(parsed.userId);
    conditions.push(`o.user_id = $${values.length}`);
  }

  if (parsed.status !== "all") {
    values.push(parsed.status);
    conditions.push(`o.status = $${values.length}`);
  }

  if (parsed.search) {
    values.push(`%${parsed.search}%`);
    const index = values.length;
    conditions.push(
      `(
        CAST(o.id AS TEXT) ILIKE $${index}
        OR COALESCE(u.company_name, '') ILIKE $${index}
        OR COALESCE(u.contact_name, '') ILIKE $${index}
        OR u.email ILIKE $${index}
      )`
    );
  }

  if (parsed.startDate) {
    values.push(`${parsed.startDate}T00:00:00.000Z`);
    conditions.push(`o.created_at >= $${values.length}::timestamptz`);
  }

  if (parsed.endDate) {
    values.push(`${parsed.endDate}T23:59:59.999Z`);
    conditions.push(`o.created_at <= $${values.length}::timestamptz`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const result = await query<OrderRow>(
      `
        ${ORDER_LIST_QUERY}
        ${whereClause}
        ORDER BY o.created_at DESC, oi.id ASC
      `,
      values
    );

    return NextResponse.json({
      orders: mapOrderRows(result.rows, true),
    });
  } catch (error) {
    console.error("GET /api/admin/orders failed:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
