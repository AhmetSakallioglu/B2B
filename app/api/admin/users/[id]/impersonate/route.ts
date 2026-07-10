import { NextResponse } from "next/server";
import { requireCanImpersonate } from "@/lib/api-auth";
import { startUserImpersonation, withSessionCookie } from "@/lib/impersonation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireCanImpersonate();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const targetUserId = Number.parseInt(id, 10);

  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const result = await startUserImpersonation({
      admin: auth.user!,
      targetUserId,
    });

    const response = NextResponse.json({
      ok: true,
      redirectUrl: result.redirectUrl,
      impersonation: result.context,
    });

    return withSessionCookie(response, result.token);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start impersonation",
      },
      { status: 400 }
    );
  }
}
