import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  createSessionToken,
  getSessionCookieOptions,
} from "@/lib/auth";
import { query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { bumpUserSessionVersion } from "@/lib/session-version";
import {
  mapUserProfileRow,
  parseUpdateCredentialsBody,
  USER_PROFILE_SELECT,
} from "@/lib/user-profile";
import type { UserProfileRow } from "@/types/account";

type UserCredentialRow = UserProfileRow & {
  password_hash: string;
  session_version: number;
};

export async function PATCH(request: Request) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  const body = parseUpdateCredentialsBody(await request.json());

  if (!body) {
    return NextResponse.json(
      {
        error:
          "Current password is required. New password must be at least 8 characters, include letters and numbers, and match confirmation.",
      },
      { status: 400 }
    );
  }

  if (!body.email && !body.newPassword) {
    return NextResponse.json(
      { error: "Provide a new email and/or new password to update" },
      { status: 400 }
    );
  }

  try {
    const current = await query<UserCredentialRow>(
      `
        SELECT ${USER_PROFILE_SELECT}, password_hash, session_version
        FROM users
        WHERE id = $1
      `,
      [auth.user!.id]
    );

    if (current.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = current.rows[0];
    const passwordValid = await verifyPassword(
      body.currentPassword,
      user.password_hash
    );

    if (!passwordValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const nextEmail = body.email ?? user.email;

    if (body.email && body.email !== user.email) {
      const existing = await query<{ id: number }>(
        "SELECT id FROM users WHERE email = $1 AND id <> $2",
        [body.email, user.id]
      );

      if (existing.rows.length > 0) {
        return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
      }
    }

    const nextPasswordHash = body.newPassword
      ? await hashPassword(body.newPassword)
      : user.password_hash;

    const result = await query<UserProfileRow>(
      `
        UPDATE users
        SET
          email = $2,
          password_hash = $3,
          updated_at = NOW()
        WHERE id = $1
        RETURNING ${USER_PROFILE_SELECT}
      `,
      [user.id, nextEmail, nextPasswordHash]
    );

    const profile = mapUserProfileRow(result.rows[0]);
    const response = NextResponse.json({ profile });

    if (nextEmail !== user.email || body.newPassword) {
      const sessionVersion =
        (await bumpUserSessionVersion(user.id)) ?? user.session_version + 1;
      const token = await createSessionToken({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        sessionVersion,
      });
      response.cookies.set(getSessionCookieOptions(token));
    }

    return response;
  } catch (error) {
    console.error("PATCH /api/account/credentials failed:", error);
    return NextResponse.json(
      { error: "Failed to update account credentials" },
      { status: 500 }
    );
  }
}
