import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import {
  fetchUserStatusAuditSnapshot,
  logUserStatusChange,
} from "@/lib/admin-audit-log";
import { bumpUserSessionVersion } from "@/lib/session-version";
import { mapAdminUserDetail } from "@/lib/admin-users";
import { ADMIN_USER_SELECT } from "@/lib/customer-tier";
import { query } from "@/lib/db";
import {
  parseApprovalAction,
  type AccountAccessAction,
  type AccountStatus,
} from "@/lib/user-approval";
import type { AdminUserRow } from "@/types/customer-tier";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function nextStatusForAction(action: AccountAccessAction): AccountStatus {
  if (action === "approve") {
    return "approved";
  }

  if (action === "reject") {
    return "rejected";
  }

  if (action === "delete") {
    return "deleted";
  }

  return "pending";
}

async function authorizeAccessAction(action: AccountAccessAction) {
  if (action === "approve") {
    return requireAdminPermission("can_approve_users");
  }

  if (action === "reject") {
    return requireAdminPermission("can_ban_users");
  }

  if (action === "restore") {
    return requireAnyAdminPermission(["can_delete_users", "can_approve_users"]);
  }

  return requireAdminPermission("can_delete_users");
}

export async function POST(request: Request, context: RouteContext) {
  const action = parseApprovalAction(await request.json());

  if (!action) {
    return NextResponse.json({ error: "Invalid approval action" }, { status: 400 });
  }

  const auth = await authorizeAccessAction(action);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const userId = Number.parseInt(id, 10);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const existing = await query<{
      id: number;
      role: "customer" | "admin";
      account_status: AccountStatus;
    }>("SELECT id, role, account_status FROM users WHERE id = $1", [userId]);

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const current = existing.rows[0];

    if (current.role === "admin") {
      return NextResponse.json(
        { error: "Admin accounts cannot be approved, banned, or deleted this way" },
        { status: 400 }
      );
    }

    if (action !== "restore" && current.account_status === "deleted") {
      return NextResponse.json(
        { error: "Restore this deleted member before changing account access" },
        { status: 400 }
      );
    }

    if (action === "restore" && current.account_status !== "deleted") {
      return NextResponse.json({ error: "Only deleted members can be restored" }, { status: 400 });
    }

    const oldStatus = await fetchUserStatusAuditSnapshot(userId);

    if (!oldStatus) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const nextStatus = nextStatusForAction(action);

    if (current.account_status === nextStatus) {
      const alreadyMessage =
        nextStatus === "rejected"
          ? "Account is already banned"
          : nextStatus === "deleted"
            ? "Account is already deleted"
            : nextStatus === "pending"
              ? "Account is already pending"
              : "Account is already approved";

      return NextResponse.json({ error: alreadyMessage }, { status: 409 });
    }

    await query(
      `
        UPDATE users
        SET
          account_status = $2,
          reviewed_at = NOW(),
          reviewed_by = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [userId, nextStatus, auth.user!.id]
    );

    await bumpUserSessionVersion(userId);

    const newStatus = await fetchUserStatusAuditSnapshot(userId);

    if (newStatus) {
      await logUserStatusChange({
        adminUserId: auth.user!.id,
        targetUserId: userId,
        oldStatus,
        newStatus,
      });
    }

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
    console.error("POST /api/admin/users/[id]/approval failed:", error);
    return NextResponse.json({ error: "Failed to update account approval" }, { status: 500 });
  }
}
