import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth-constants";
import { assertRequiredEnv } from "@/lib/env";
import { query } from "@/lib/db";
import type {
  ImpersonationTokenMeta,
  ResolvedSessionUser,
  SessionUser,
  UserRole,
} from "@/types/auth";
import type { AccountStatus } from "@/lib/user-approval";
import { isAccountUsable } from "@/lib/user-approval";

export { AUTH_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };

function getAuthSecret() {
  assertRequiredEnv();

  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

export async function createSessionToken(
  user: SessionUser,
  impersonation?: ImpersonationTokenMeta
) {
  const payload: Record<string, string | number> = {
    email: user.email,
    role: user.role,
    sv: user.sessionVersion,
  };

  if (impersonation) {
    payload.iby = impersonation.impersonatedBy;
    payload.asv = impersonation.adminSessionVersion;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecret());
}

function parseImpersonationClaims(payload: Record<string, unknown>) {
  const impersonatedBy =
    typeof payload.iby === "number" && Number.isInteger(payload.iby) && payload.iby > 0
      ? payload.iby
      : null;
  const adminSessionVersion =
    typeof payload.asv === "number" && Number.isInteger(payload.asv) && payload.asv > 0
      ? payload.asv
      : null;

  if (!impersonatedBy || !adminSessionVersion) {
    return null;
  }

  return {
    impersonatedBy,
    adminSessionVersion,
  } satisfies ImpersonationTokenMeta;
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getAuthSecret());
  const userId = Number(payload.sub);

  if (!payload.sub || Number.isNaN(userId)) {
    return null;
  }

  if (typeof payload.email !== "string" || typeof payload.role !== "string") {
    return null;
  }

  if (payload.role !== "customer" && payload.role !== "admin") {
    return null;
  }

  const sessionVersion =
    typeof payload.sv === "number" && Number.isInteger(payload.sv) && payload.sv > 0
      ? payload.sv
      : null;

  if (!sessionVersion) {
    return null;
  }

  const impersonation = parseImpersonationClaims(payload as Record<string, unknown>);

  return {
    id: userId,
    email: payload.email,
    role: payload.role as UserRole,
    sessionVersion,
    impersonatedBy: impersonation?.impersonatedBy,
    adminSessionVersion: impersonation?.adminSessionVersion,
  } satisfies ResolvedSessionUser;
}

export async function getSessionUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

async function resolveSessionUserFromDatabase(
  userId: number,
  sessionVersion: number
): Promise<SessionUser | null> {
  const result = await query<{
    id: number;
    email: string;
    role: UserRole;
    account_status: AccountStatus;
    session_version: number;
  }>(
    "SELECT id, email, role, account_status, session_version FROM users WHERE id = $1",
    [userId]
  );

  const row = result.rows[0];

  if (!row || !isAccountUsable(row.role, row.account_status)) {
    return null;
  }

  if (row.session_version !== sessionVersion) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    sessionVersion: row.session_version,
  };
}

export async function getSessionUser(): Promise<ResolvedSessionUser | null> {
  const tokenUser = await getSessionUserFromToken();

  if (!tokenUser) {
    return null;
  }

  const dbUser = await resolveSessionUserFromDatabase(tokenUser.id, tokenUser.sessionVersion);

  if (!dbUser) {
    return null;
  }

  if (tokenUser.impersonatedBy && tokenUser.adminSessionVersion) {
    const adminUser = await resolveSessionUserFromDatabase(
      tokenUser.impersonatedBy,
      tokenUser.adminSessionVersion
    );

    if (!adminUser || adminUser.role !== "admin") {
      return null;
    }
  }

  return {
    ...dbUser,
    impersonatedBy: tokenUser.impersonatedBy,
    adminSessionVersion: tokenUser.adminSessionVersion,
  };
}

export function getSessionCookieOptions(token: string) {
  return {
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function getClearSessionCookieOptions() {
  return {
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
  };
}
