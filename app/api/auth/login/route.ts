import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookieOptions,
} from "@/lib/auth";
import { PASSWORD_MAX_LENGTH } from "@/lib/password-policy";
import { verifyPasswordWithTimingProtection } from "@/lib/password";
import { query } from "@/lib/db";
import { cacheEdgeSessionState } from "@/lib/session-edge-cache";
import { enforceMutationSecurity } from "@/lib/request-security";
import {
  AUTH_BACKOFF_SCOPES,
  clearExponentialBackoff,
  recordExponentialBackoffFailure,
} from "@/lib/exponential-backoff-limit";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { isAccountUsable, LOGIN_STATUS_MESSAGES } from "@/lib/user-approval";
import type { AuthErrorCode, UserRole } from "@/types/auth";
import type { AccountStatus } from "@/lib/user-approval";

type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  account_status: AccountStatus;
  session_version: number;
};

function parseCredentials(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.email !== "string" || typeof candidate.password !== "string") {
    return null;
  }

  const email = candidate.email.trim().toLowerCase();
  const password = candidate.password;

  if (!email || !password || password.length > PASSWORD_MAX_LENGTH) {
    return null;
  }

  return { email, password };
}

function accountStatusError(status: AccountStatus) {
  if (status === "pending") {
    return {
      status: 403,
      code: "ACCOUNT_PENDING" satisfies AuthErrorCode,
      message: LOGIN_STATUS_MESSAGES.pending,
    } as const;
  }

  if (status === "rejected") {
    return {
      status: 403,
      code: "ACCOUNT_REJECTED" satisfies AuthErrorCode,
      message: LOGIN_STATUS_MESSAGES.rejected,
    } as const;
  }

  if (status === "deleted") {
    return {
      status: 403,
      code: "ACCOUNT_DELETED" satisfies AuthErrorCode,
      message: LOGIN_STATUS_MESSAGES.deleted,
    } as const;
  }

  return null;
}

export async function POST(request: Request) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  try {
    const credentials = parseCredentials(await request.json());

    if (!credentials) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const result = await query<UserRow>(
      "SELECT id, email, password_hash, role, account_status, session_version FROM users WHERE email = $1",
      [credentials.email]
    );

    const user = result.rows[0];
    const isValid = await verifyPasswordWithTimingProtection(
      credentials.password,
      user?.password_hash
    );

    if (!user || !isValid) {
      await recordExponentialBackoffFailure(
        AUTH_BACKOFF_SCOPES.login,
        getClientIpFromRequest(request)
      );

      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!isAccountUsable(user.role, user.account_status)) {
      const statusError = accountStatusError(user.account_status);

      if (statusError) {
        return NextResponse.json(
          { error: statusError.message, code: statusError.code },
          { status: statusError.status }
        );
      }
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionVersion: user.session_version,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(getSessionCookieOptions(token));
    await cacheEdgeSessionState(user.id, user.session_version, true);
    await clearExponentialBackoff(AUTH_BACKOFF_SCOPES.login, getClientIpFromRequest(request));

    await query(
      `
        UPDATE users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [user.id]
    );

    return response;
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
