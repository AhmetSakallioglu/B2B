import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAdminNotificationCounts } from "@/lib/admin-notifications";
import { hasAdminPermission } from "@/types/admin-permissions";

export async function GET() {
  const auth = await requireAdmin();

  if (auth.response) {
    return auth.response;
  }

  try {
    const counts = await getAdminNotificationCounts();
    const permissions = auth.permissions!;

    return NextResponse.json({
      pendingUsers: hasAdminPermission(permissions, "can_approve_users")
        ? counts.pendingUsers
        : 0,
      pendingOrders: hasAdminPermission(permissions, "can_view_orders")
        ? counts.pendingOrders
        : 0,
    });
  } catch (error) {
    console.error("GET /api/admin/notifications/counts failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification counts" },
      { status: 500 }
    );
  }
}
