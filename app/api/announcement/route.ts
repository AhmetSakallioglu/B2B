import { NextResponse } from "next/server";
import { getActiveAnnouncementsForCustomer } from "@/lib/announcement";
import { requireCustomerSession } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireCustomerSession();

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname")?.trim() || undefined;
  const announcements = await getActiveAnnouncementsForCustomer(pathname);

  return NextResponse.json({
    announcements,
    announcement: announcements[0] ?? null,
  });
}
