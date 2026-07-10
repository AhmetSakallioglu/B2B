import { NextResponse } from "next/server";
import { getClearSessionCookieOptions, getSessionUserFromToken } from "@/lib/auth";
import { enforceMutationSecurity } from "@/lib/request-security";
import { bumpUserSessionVersion } from "@/lib/session-version";

export async function POST(request: Request) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  const user = await getSessionUserFromToken();

  if (user) {
    await bumpUserSessionVersion(user.id);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(getClearSessionCookieOptions());

  return response;
}
