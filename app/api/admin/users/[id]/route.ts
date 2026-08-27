import { NextResponse } from "next/server";
import { requireAnyAdminPermission, requireSuperAdmin } from "@/lib/api-auth";
import { revokeUserSessions } from "@/lib/session-version";
import { validateAdminUserUpdateAuthorization } from "@/lib/admin-user-update-auth";
import { ensureAdminPermissionsRow } from "@/lib/admin-permissions";
import {
  fetchUserStatusAuditSnapshot,
  fetchUserTierAuditSnapshot,
  logUserProfileUpdated,
  logUserStatusChange,
  logUserTierChange,
} from "@/lib/admin-audit-log";
import { mapAdminUserDetail, mapAdminUserTierView, parseUpdateAdminUserBody } from "@/lib/admin-users";
import { ADMIN_USER_SELECT, getCustomerTierById } from "@/lib/customer-tier";
import { query } from "@/lib/db";
import type { AccountStatus } from "@/lib/user-approval";
import { USER_DIRECTORY_PERMISSIONS, hasAnyAdminPermission } from "@/types/admin-permissions";
import type { AdminUserRow } from "@/types/customer-tier";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAnyAdminPermission(USER_DIRECTORY_PERMISSIONS);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const userId = Number.parseInt(id, 10);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const result = await query<AdminUserRow>(
      `
        SELECT ${ADMIN_USER_SELECT}
        FROM users u
        LEFT JOIN customer_tiers ct ON ct.id = u.tier_id
        WHERE u.id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const row = result.rows[0];
    const canViewSensitivePii = hasAnyAdminPermission(auth.permissions!, [
      "can_approve_users",
      "can_ban_users",
      "can_create_users",
      "can_delete_users",
    ]);

    return NextResponse.json({
      user: canViewSensitivePii ? mapAdminUserDetail(row) : mapAdminUserTierView(row),
    });
  } catch (error) {
    console.error("GET /api/admin/users/[id] failed:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAnyAdminPermission(USER_DIRECTORY_PERMISSIONS);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const userId = Number.parseInt(id, 10);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = parseUpdateAdminUserBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid user payload" }, { status: 400 });
  }

  try {
    const existing = await query<{
      id: number;
      role: "customer" | "admin";
      account_status: AccountStatus;
      session_version: number;
      tier_id: number | null;
      company_name: string | null;
      contact_name: string | null;
      phone: string | null;
      address_line1: string | null;
      address_line2: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      country: string | null;
      group_tag: string;
    }>(
      `
        SELECT
          id,
          role,
          account_status,
          session_version,
          tier_id,
          company_name,
          contact_name,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          group_tag
        FROM users
        WHERE id = $1
      `,
      [userId]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const current = existing.rows[0];

    const authorizationError = validateAdminUserUpdateAuthorization(
      auth.permissions!,
      body,
      current
    );

    if (authorizationError) {
      return authorizationError;
    }

    const nextRole = body.role ?? current.role;

    if (nextRole === "admin" && current.role !== "admin") {
      const superAuth = await requireSuperAdmin(request);

      if (superAuth.response) {
        return superAuth.response;
      }
    }

    if (userId === auth.user!.id && nextRole !== "admin") {
      return NextResponse.json(
        { error: "You cannot remove your own admin access" },
        { status: 400 }
      );
    }

    let nextAccountStatus = body.accountStatus ?? current.account_status;

    if (nextRole === "admin") {
      nextAccountStatus = "approved";
    } else if (body.accountStatus === "pending" && current.account_status !== "pending") {
      return NextResponse.json(
        { error: "Approved or rejected accounts cannot be moved back to pending" },
        { status: 400 }
      );
    }

    const accountStatusChanged = nextAccountStatus !== current.account_status;

    let nextTierId: number | null =
      body.tierId !== undefined ? body.tierId : current.tier_id;

    if (body.tierId === undefined) {
      nextTierId = current.tier_id;
    }

    if (nextRole === "admin") {
      nextTierId = null;
    } else if (nextTierId !== null) {
      const tier = await getCustomerTierById(nextTierId);

      if (!tier) {
        return NextResponse.json({ error: "Selected tier not found" }, { status: 400 });
      }
    }

    const oldTier = await fetchUserTierAuditSnapshot(userId);
    const oldStatus = await fetchUserStatusAuditSnapshot(userId);

    const nextGroupTag =
      nextRole === "customer" && body.groupTag !== undefined
        ? body.groupTag
        : current.group_tag;

    await query(
      `
        UPDATE users
        SET
          role = $2,
          account_status = $3,
          tier_id = $4,
          company_name = COALESCE($5, company_name),
          contact_name = COALESCE($6, contact_name),
          phone = COALESCE($7, phone),
          address_line1 = COALESCE($8, address_line1),
          address_line2 = COALESCE($9, address_line2),
          city = COALESCE($10, city),
          state = COALESCE($11, state),
          postal_code = COALESCE($12, postal_code),
          country = COALESCE($13, country),
          group_tag = $14,
          reviewed_at = CASE
            WHEN $15 THEN NOW()
            ELSE reviewed_at
          END,
          reviewed_by = CASE
            WHEN $15 THEN $16
            ELSE reviewed_by
          END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        userId,
        nextRole,
        nextAccountStatus,
        nextTierId,
        body.companyName ?? null,
        body.contactName ?? null,
        body.phone ?? null,
        body.addressLine1 ?? null,
        body.addressLine2 ?? null,
        body.city ?? null,
        body.state ?? null,
        body.postalCode ?? null,
        body.country ?? null,
        nextGroupTag,
        accountStatusChanged,
        auth.user!.id,
      ]
    );

    if (nextRole === "admin") {
      await ensureAdminPermissionsRow(userId);
    }

    if (accountStatusChanged || nextRole !== current.role) {
      await revokeUserSessions(userId, current.session_version);
    }

    const newTier = await fetchUserTierAuditSnapshot(userId);
    const newStatus = await fetchUserStatusAuditSnapshot(userId);

    if (oldTier && newTier) {
      await logUserTierChange({
        adminUserId: auth.user!.id,
        targetUserId: userId,
        oldTier,
        newTier,
      });
    }

    if (oldStatus && newStatus) {
      await logUserStatusChange({
        adminUserId: auth.user!.id,
        targetUserId: userId,
        oldStatus,
        newStatus,
      });
    }

    const profileFields = {
      company_name: body.companyName ?? current.company_name,
      contact_name: body.contactName ?? current.contact_name,
      phone: body.phone ?? current.phone,
      address_line1: body.addressLine1 ?? current.address_line1,
      address_line2: body.addressLine2 ?? current.address_line2,
      city: body.city ?? current.city,
      state: body.state ?? current.state,
      postal_code: body.postalCode ?? current.postal_code,
      country: body.country ?? current.country,
      group_tag: nextGroupTag,
      role: nextRole,
    };

    const oldProfile = {
      company_name: current.company_name,
      contact_name: current.contact_name,
      phone: current.phone,
      address_line1: current.address_line1,
      address_line2: current.address_line2,
      city: current.city,
      state: current.state,
      postal_code: current.postal_code,
      country: current.country,
      group_tag: current.group_tag,
      role: current.role,
    };

    await logUserProfileUpdated({
      adminUserId: auth.user!.id,
      targetUserId: userId,
      oldValues: oldProfile,
      newValues: profileFields,
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

    return NextResponse.json({ user: mapAdminUserDetail(result.rows[0]) });
  } catch (error) {
    console.error("PATCH /api/admin/users/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
