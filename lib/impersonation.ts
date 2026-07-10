import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookieOptions,
  getSessionUserFromToken,
} from "@/lib/auth";
import { query } from "@/lib/db";
import {
  logImpersonationStarted,
  logImpersonationStopped,
} from "@/lib/impersonation-audit-log";
import { isAccountUsable } from "@/lib/user-approval";
import type { ImpersonationContext, SessionUser } from "@/types/auth";
import type { AccountStatus } from "@/lib/user-approval";
import type { UserRole } from "@/types/auth";

type UserImpersonationRow = {
  id: number;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  session_version: number;
  company_name: string | null;
  contact_name: string | null;
};

export async function fetchImpersonationContext(
  customerUserId: number,
  adminId: number
): Promise<ImpersonationContext | null> {
  const result = await query<{
    customer_email: string;
    company_name: string | null;
    contact_name: string | null;
    admin_email: string;
  }>(
    `
      SELECT
        customer.email AS customer_email,
        customer.company_name,
        customer.contact_name,
        admin.email AS admin_email
      FROM users customer
      INNER JOIN users admin ON admin.id = $2
      WHERE customer.id = $1
    `,
    [customerUserId, adminId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    adminId,
    companyName: row.company_name,
    contactName: row.contact_name,
    customerEmail: row.customer_email,
  };
}

async function loadImpersonationTarget(userId: number) {
  const result = await query<UserImpersonationRow>(
    `
      SELECT id, email, role, account_status, session_version, company_name, contact_name
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function startUserImpersonation(params: {
  admin: SessionUser;
  targetUserId: number;
}) {
  const tokenUser = await getSessionUserFromToken();

  if (tokenUser?.impersonatedBy) {
    throw new Error("Already impersonating a customer. Exit impersonation first.");
  }

  if (params.admin.role !== "admin") {
    throw new Error("Admin access required");
  }

  if (params.targetUserId === params.admin.id) {
    throw new Error("You cannot impersonate your own account");
  }

  const target = await loadImpersonationTarget(params.targetUserId);

  if (!target) {
    throw new Error("User not found");
  }

  if (target.role !== "customer") {
    throw new Error("Only dealer accounts can be impersonated");
  }

  if (!isAccountUsable(target.role, target.account_status)) {
    throw new Error("This dealer account is not approved for ordering");
  }

  const customerSession: SessionUser = {
    id: target.id,
    email: target.email,
    role: "customer",
    sessionVersion: target.session_version,
  };

  const token = await createSessionToken(customerSession, {
    impersonatedBy: params.admin.id,
    adminSessionVersion: params.admin.sessionVersion,
  });

  await logImpersonationStarted({
    adminId: params.admin.id,
    customerUserId: target.id,
    customerEmail: target.email,
    companyName: target.company_name,
    contactName: target.contact_name,
  });

  return {
    token,
    redirectUrl: "/catalog",
    context: {
      adminId: params.admin.id,
      companyName: target.company_name,
      contactName: target.contact_name,
      customerEmail: target.email,
    } satisfies ImpersonationContext,
  };
}

export async function stopUserImpersonation() {
  const tokenUser = await getSessionUserFromToken();

  if (!tokenUser?.impersonatedBy || !tokenUser.adminSessionVersion) {
    throw new Error("Not currently impersonating a customer");
  }

  const admin = await query<UserImpersonationRow>(
    `
      SELECT id, email, role, account_status, session_version, company_name, contact_name
      FROM users
      WHERE id = $1
    `,
    [tokenUser.impersonatedBy]
  );

  const row = admin.rows[0];

  if (!row || row.role !== "admin" || !isAccountUsable(row.role, row.account_status)) {
    throw new Error("Original admin session is no longer valid");
  }

  if (row.session_version !== tokenUser.adminSessionVersion) {
    throw new Error("Original admin session expired. Please sign in again.");
  }

  const impersonationContext = await fetchImpersonationContext(
    tokenUser.id,
    tokenUser.impersonatedBy
  );

  if (impersonationContext) {
    await logImpersonationStopped({
      adminId: impersonationContext.adminId,
      customerUserId: tokenUser.id,
      customerEmail: impersonationContext.customerEmail,
      companyName: impersonationContext.companyName,
      contactName: impersonationContext.contactName,
    });
  }

  const adminSession: SessionUser = {
    id: row.id,
    email: row.email,
    role: "admin",
    sessionVersion: row.session_version,
  };

  const token = await createSessionToken(adminSession);

  return {
    token,
    redirectUrl: "/admin/users",
  };
}

export function withSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(getSessionCookieOptions(token));
  return response;
}
