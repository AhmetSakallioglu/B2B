import { NextResponse } from "next/server";
import { processAbandonedCartRecovery } from "@/lib/abandoned-cart-recovery";
import { isAuthorizedCron } from "@/lib/cron-auth";

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processAbandonedCartRecovery();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/cron/abandoned-carts failed:", error);
    return NextResponse.json({ error: "Failed to process abandoned carts" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processAbandonedCartRecovery();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("GET /api/cron/abandoned-carts failed:", error);
    return NextResponse.json({ error: "Failed to process abandoned carts" }, { status: 500 });
  }
}
