import { NextResponse } from "next/server";
import { forceReshowAnnouncementToAllUsers } from "@/lib/announcement";
import { requireAdminPermission } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_manage_announcements", request);

  if (auth.response) {
    return auth.response;
  }

  const settings = await forceReshowAnnouncementToAllUsers(auth.user!.id);

  return NextResponse.json({
    settings,
    message: "Announcement version refreshed. All dealers will see the popup again.",
  });
}
