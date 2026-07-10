import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { saveTaxDocument } from "@/lib/save-tax-document";
import { submitResaleCertificate } from "@/lib/tax-exemption";
import { USER_PROFILE_SELECT, mapUserProfileRow } from "@/lib/user-profile";
import { query } from "@/lib/db";
import type { UserProfileRow } from "@/types/account";
import { enforceMutationSecurity } from "@/lib/request-security";

export async function POST(request: Request) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("certificate");

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Resale certificate file is required" }, { status: 400 });
    }

    const certificateUrl = await saveTaxDocument(file);

    await submitResaleCertificate({
      userId: auth.user!.id,
      certificateUrl,
    });

    const result = await query<UserProfileRow>(
      `
        SELECT ${USER_PROFILE_SELECT}
        FROM users
        WHERE id = $1
      `,
      [auth.user!.id]
    );

    return NextResponse.json({
      ok: true,
      message:
        "Your certificate is under review. Sales tax will apply until approved.",
      profile: mapUserProfileRow(result.rows[0], null),
    });
  } catch (error) {
    console.error("POST /api/account/tax-exemption failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload resale certificate",
      },
      { status: 400 }
    );
  }
}
