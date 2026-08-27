import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import { logUserCreated } from "@/lib/admin-audit-log";
import { parseSanitizedAdminUserListQuery } from "@/lib/admin-search-sanitization";
import { mapAdminUserSummary, parseCreateAdminUserBody } from "@/lib/admin-users";
import { ADMIN_USER_SELECT } from "@/lib/customer-tier";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { USER_DIRECTORY_PERMISSIONS } from "@/types/admin-permissions";
import type { AdminUserRow } from "@/types/customer-tier";

export async function GET(request: Request) {
  const auth = await requireAnyAdminPermission(USER_DIRECTORY_PERMISSIONS);

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

  if (status === "pending" || status === "approved" || status === "rejected" || status === "deleted") {
    values.push(status);
    conditions.push(`u.account_status = $${values.length}`);
  } else {
    conditions.push(`u.account_status <> 'deleted'`);
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
    const [result, deletedCountResult] = await Promise.all([
      query<AdminUserRow>(
        `
          SELECT ${ADMIN_USER_SELECT}
          FROM users u
          LEFT JOIN customer_tiers ct ON ct.id = u.tier_id
          ${whereClause}
          ORDER BY u.created_at DESC
        `,
        values
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE account_status = 'deleted'`
      ),
    ]);

    return NextResponse.json({
      users: result.rows.map(mapAdminUserSummary),
      deletedCount: Number.parseInt(deletedCountResult.rows[0]?.count ?? "0", 10) || 0,
    });
  } catch (error) {
    console.error("GET /api/admin/users failed:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_create_users");

  if (auth.response) {
    return auth.response;
  }

  try {
    const parsed = parseCreateAdminUserBody(await request.json());

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const body = parsed.data;

    if (body.accountStatus === "approved" && !auth.permissions?.can_approve_users && !auth.permissions?.isSuperAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to create an approved member" },
        { status: 403 }
      );
    }

    const existing = await query<{ id: number; account_status: string }>(
      "SELECT id, account_status FROM users WHERE email = $1",
      [body.email]
    );

    if (existing.rows.length > 0) {
      const existingStatus = existing.rows[0].account_status;
      return NextResponse.json(
        {
          error:
            existingStatus === "deleted"
              ? "A deleted member already uses this email. Restore that account instead."
              : "A member with this email already exists",
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(body.password ?? randomBytes(32).toString("hex"));

    const inserted = await query<{ id: number }>(
      `
        INSERT INTO users (
          email,
          password_hash,
          role,
          account_status,
          company_name,
          contact_name,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          reviewed_at,
          reviewed_by
        )
        VALUES (
          $1, $2, 'customer', $3::account_status,
          $4, $5, $6, $7, $8, $9, $10, $11, $12,
          CASE WHEN $3::account_status = 'approved' THEN NOW() ELSE NULL END,
          CASE WHEN $3::account_status = 'approved' THEN $13::integer ELSE NULL END
        )
        RETURNING id
      `,
      [
        body.email,
        passwordHash,
        body.accountStatus,
        body.companyName || null,
        body.contactName || null,
        body.phone || null,
        body.addressLine1 || null,
        body.addressLine2 || null,
        body.city || null,
        body.state || null,
        body.postalCode || null,
        body.country || null,
        auth.user!.id,
      ]
    );

    const userId = inserted.rows[0].id;

    await logUserCreated({
      adminUserId: auth.user!.id,
      userId,
      email: body.email,
      accountStatus: body.accountStatus,
    });

    const result = await query<AdminUserRow>(
      `
        SELECT ${ADMIN_USER_SELECT}
        FROM users u
        LEFT JOIN customer_tiers ct ON ct.id = u.tier_id
        WHERE u.id = $1
      `,
      [userId]
    );

    return NextResponse.json({ user: mapAdminUserSummary(result.rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/users failed:", error);
    return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
  }
}
