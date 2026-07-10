import { NextResponse } from "next/server";
import { requireAnyAdminPermission } from "@/lib/api-auth";
import { parseSanitizedAdminUserListQuery } from "@/lib/admin-search-sanitization";
import { mapAdminUserSummary } from "@/lib/admin-users";
import { ADMIN_USER_SELECT } from "@/lib/customer-tier";
import { query } from "@/lib/db";
import type { AdminUserRow } from "@/types/customer-tier";

export async function GET(request: Request) {
  const auth = await requireAnyAdminPermission([
    "can_approve_users",
    "can_ban_users",
    "can_view_user_tiers",
    "can_change_user_tier",
  ]);

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const parsed = await parseSanitizedAdminUserListQuery(
    request,
    searchParams,
    auth.user!.id
  );

  if (parsed.blocked) {
    return parsed.blocked;
  }

  const search = parsed.search;
  const status = parsed.status;

  const conditions: string[] = [];
  const values: string[] = [];

  if (status === "pending" || status === "approved" || status === "rejected") {
    values.push(status);
    conditions.push(`u.account_status = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(
      `(
        u.email ILIKE $${index}
        OR COALESCE(u.company_name, '') ILIKE $${index}
        OR COALESCE(u.contact_name, '') ILIKE $${index}
      )`
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const result = await query<AdminUserRow>(
      `
        SELECT ${ADMIN_USER_SELECT}
        FROM users u
        LEFT JOIN customer_tiers ct ON ct.id = u.tier_id
        ${whereClause}
        ORDER BY u.created_at DESC
      `,
      values
    );

    return NextResponse.json({
      users: result.rows.map(mapAdminUserSummary),
    });
  } catch (error) {
    console.error("GET /api/admin/users failed:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
