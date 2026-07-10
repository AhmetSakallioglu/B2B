import { NextResponse } from "next/server";
import { getAdminPermissions } from "@/lib/admin-permissions";
import {
  hasAdminPermission,
  hasAnyAdminPermission,
  PERMISSION_FORBIDDEN_MESSAGE,
  type AdminPermissionKey,
} from "@/types/admin-permissions";
import { getSessionUser } from "@/lib/auth";
import { enforceMutationSecurity, enforceMutationSecurityFromContext } from "@/lib/request-security";
import type { SessionUser } from "@/types/auth";
import type { AdminPermissions } from "@/types/admin-permissions";

import type { AuthResult } from "@/types/zero-trust";

export type { AuthResult };

type AuthFailure = Extract<AuthResult, { user: null }>;
type AuthSuccess = Extract<AuthResult, { user: SessionUser }>;

async function blockIfUnsafeMutationAsync(request?: Request): Promise<NextResponse | null> {
  if (request) {
    return enforceMutationSecurity(request);
  }

  return enforceMutationSecurityFromContext();
}

export async function requireSession(request?: Request): Promise<AuthResult> {
  const mutationBlocked = await blockIfUnsafeMutationAsync(request);

  if (mutationBlocked) {
    return {
      user: null,
      permissions: null,
      response: mutationBlocked,
    };
  }

  const user = await getSessionUser();

  if (!user) {
    return {
      user: null,
      permissions: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  return { user, permissions: null, response: null };
}

export async function requireAdmin(request?: Request): Promise<AuthResult> {
  const result = await requireSession(request);

  if (result.response) {
    return result;
  }

  const user = result.user as SessionUser;

  if (user.role !== "admin") {
    return {
      user: null,
      permissions: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }

  const permissions = await getAdminPermissions(user.id);

  return { user, permissions, response: null };
}

export async function requireSuperAdmin(request?: Request): Promise<AuthResult> {
  const auth = await requireAdmin(request);

  if (auth.response) {
    return auth;
  }

  if (!auth.permissions!.isSuperAdmin) {
    return {
      user: null,
      permissions: null,
      response: NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 }),
    };
  }

  return auth;
}

export async function requireAdminPermission(
  permission: AdminPermissionKey,
  request?: Request
): Promise<AuthResult> {
  const auth = await requireAdmin(request);

  if (auth.response) {
    return auth;
  }

  if (!hasAdminPermission(auth.permissions!, permission)) {
    return {
      user: null,
      permissions: null,
      response: NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 }),
    };
  }

  return auth as AuthSuccess & { permissions: AdminPermissions };
}

export async function requireAnyAdminPermission(
  permissions: AdminPermissionKey[],
  request?: Request
): Promise<AuthResult> {
  const auth = await requireAdmin(request);

  if (auth.response) {
    return auth;
  }

  if (!hasAnyAdminPermission(auth.permissions!, permissions)) {
    return {
      user: null,
      permissions: null,
      response: NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 }),
    };
  }

  return auth as AuthSuccess & { permissions: AdminPermissions };
}

export async function requireCustomerSession(request?: Request): Promise<AuthResult> {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth;
  }

  if (auth.user!.role === "admin" && !auth.user!.impersonatedBy) {
    return {
      user: null,
      permissions: null,
      response: NextResponse.json(
        { error: "Customer account required" },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function requireCanImpersonate(request?: Request): Promise<AuthResult> {
  const auth = await requireAdmin(request);

  if (auth.response) {
    return auth;
  }

  if (!hasAdminPermission(auth.permissions!, "can_impersonate_users")) {
    return {
      user: null,
      permissions: null,
      response: NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 }),
    };
  }

  return auth as AuthSuccess & { permissions: AdminPermissions };
}
