import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { cacheEdgeSessionState } from "@/lib/session-edge-cache";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  await cacheEdgeSessionState(user.id, user.sessionVersion, true);

  return NextResponse.json({ ok: true });
}
