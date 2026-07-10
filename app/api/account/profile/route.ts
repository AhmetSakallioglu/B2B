import { NextResponse } from "next/server";
import { rejectPrivilegeEscalationAttempt } from "@/lib/privilege-escalation-guard";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";
import {
  mapUserProfileRow,
  parseUpdateProfileBody,
  USER_PROFILE_SELECT,
} from "@/lib/user-profile";
import type { UserProfileRow } from "@/types/account";

export async function GET() {
  const auth = await requireSession();

  if (auth.response) {
    return auth.response;
  }

  try {
    const result = await query<UserProfileRow>(
      `
        SELECT ${USER_PROFILE_SELECT}
        FROM users
        WHERE id = $1
      `,
      [auth.user!.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      profile: mapUserProfileRow(result.rows[0], null),
    });
  } catch (error) {
    console.error("GET /api/account/profile failed:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  const rawBody = await request.json();
  const privilegeBlocked = await rejectPrivilegeEscalationAttempt(request, rawBody, {
    route: "/api/account/profile",
    source: "profile",
  });

  if (privilegeBlocked) {
    return privilegeBlocked;
  }

  const body = parseUpdateProfileBody(rawBody);

  if (!body) {
    return NextResponse.json({ error: "Invalid profile payload" }, { status: 400 });
  }

  try {
    const result = await query<UserProfileRow>(
      `
        UPDATE users
        SET
          company_name = $2,
          contact_name = $3,
          phone = $4,
          address_line1 = $5,
          address_line2 = $6,
          city = $7,
          state = $8,
          postal_code = $9,
          country = $10,
          updated_at = NOW()
        WHERE id = $1
        RETURNING ${USER_PROFILE_SELECT}
      `,
      [
        auth.user!.id,
        body.companyName || null,
        body.contactName || null,
        body.phone || null,
        body.addressLine1 || null,
        body.addressLine2 || null,
        body.city || null,
        body.state || null,
        body.postalCode || null,
        body.country || "United States",
      ]
    );

    return NextResponse.json({
      profile: mapUserProfileRow(result.rows[0], null),
    });
  } catch (error) {
    console.error("PATCH /api/account/profile failed:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
