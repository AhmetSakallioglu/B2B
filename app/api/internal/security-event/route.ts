import { NextResponse } from "next/server";
import { isAuthorizedInternalSecurityRequest, persistSecurityEvent } from "@/lib/security-audit";
import type { SecurityEventPayload } from "@/types/active-defense";

export async function POST(request: Request) {
  if (!isAuthorizedInternalSecurityRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as SecurityEventPayload;

    if (!payload?.event || !payload.ip || !payload.path) {
      return NextResponse.json({ error: "Invalid security event payload" }, { status: 400 });
    }

    await persistSecurityEvent(payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/internal/security-event failed:", error);
    return NextResponse.json({ error: "Failed to record security event" }, { status: 500 });
  }
}
