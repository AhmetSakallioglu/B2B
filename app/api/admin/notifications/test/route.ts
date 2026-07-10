import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { sendAdminPushToPermissionTarget } from "@/lib/web-push/send";
import { isWebPushConfigured } from "@/lib/web-push/vapid";
import { listAdminPushSubscriptionsForPermission } from "@/lib/web-push/subscriptions";

export async function POST() {
  const auth = await requireAdmin();

  if (auth.response) {
    return auth.response;
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Web push is not configured. Add VAPID keys to .env.local." },
      { status: 503 }
    );
  }

  const subscriptions = await listAdminPushSubscriptionsForPermission("can_view_orders");

  if (subscriptions.length === 0) {
    return NextResponse.json(
      {
        error:
          "No push subscriptions found. Open /admin, click Enable notifications, and allow browser permission.",
      },
      { status: 409 }
    );
  }

  await sendAdminPushToPermissionTarget("can_view_orders", {
    title: "Cabinetto Admin Test",
    body: "Desktop notifications are working.",
    tag: "cabinetto-admin-test",
    url: "/admin",
  });

  return NextResponse.json({
    ok: true,
    deliveredTo: subscriptions.length,
  });
}
