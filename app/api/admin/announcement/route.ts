import { NextResponse } from "next/server";
import { getAnnouncementSettings } from "@/lib/announcement";
import { requireAdminPermission } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdminPermission("can_manage_announcements");

  if (auth.response) {
    return auth.response;
  }

  const settings = await getAnnouncementSettings();

  return NextResponse.json({ settings });
}
