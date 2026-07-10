import { NextResponse } from "next/server";
import { listAbandonedCartsForAdmin } from "@/lib/abandoned-cart";
import { listAutomationSettings } from "@/lib/automation-settings";
import { requireAdminPermission } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdminPermission("can_manage_emails");

  if (auth.response) {
    return auth.response;
  }

  const [automationSettings, carts] = await Promise.all([
    listAutomationSettings(),
    listAbandonedCartsForAdmin(),
  ]);

  return NextResponse.json({ automationSettings, carts });
}
