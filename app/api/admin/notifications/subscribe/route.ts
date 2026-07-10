import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { query } from "@/lib/db";
import {
  parsePushSubscriptionBody,
  upsertAdminPushSubscription,
} from "@/lib/web-push/subscriptions";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/web-push/vapid";

async function hasActiveSubscription(userId: number) {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM admin_push_subscriptions WHERE user_id = $1`,
    [userId]
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10) > 0;
}

export async function GET() {
  const auth = await requireAdmin();

  if (auth.response) {
    return auth.response;
  }

  const subscribed = await hasActiveSubscription(auth.user!.id);

  return NextResponse.json({
    configured: isWebPushConfigured(),
    publicKey: getVapidPublicKey(),
    subscribed,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);

  if (auth.response) {
    return auth.response;
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Web push is not configured on this server" },
      { status: 503 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const subscription = parsePushSubscriptionBody(body);

  if (!subscription) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  try {
    await upsertAdminPushSubscription({
      userId: auth.user!.id,
      subscription,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/notifications/subscribe failed:", error);
    return NextResponse.json({ error: "Failed to save push subscription" }, { status: 500 });
  }
}
