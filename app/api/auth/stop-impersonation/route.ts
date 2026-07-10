import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { stopUserImpersonation, withSessionCookie } from "@/lib/impersonation";

export async function POST(request: Request) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  if (!auth.user!.impersonatedBy) {
    return NextResponse.json({ error: "Not currently impersonating a customer" }, { status: 400 });
  }

  try {
    const result = await stopUserImpersonation();

    const response = NextResponse.json({
      ok: true,
      redirectUrl: result.redirectUrl,
    });

    return withSessionCookie(response, result.token);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to stop impersonation",
      },
      { status: 400 }
    );
  }
}
