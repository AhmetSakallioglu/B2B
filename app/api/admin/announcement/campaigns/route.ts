import { NextResponse } from "next/server";
import {
  createAnnouncementCampaign,
  listAnnouncementCampaigns,
} from "@/lib/announcement-campaigns";
import { parseAnnouncementCampaignWriteRequest } from "@/lib/announcement-campaign-request";
import { requireAdminPermission } from "@/lib/api-auth";
import { databaseSetupHint } from "@/lib/db-setup-hints";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminPermission("can_manage_announcements");

  if (auth.response) {
    return auth.response;
  }

  try {
    const campaigns = await listAnnouncementCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("GET /api/admin/announcement/campaigns failed:", error);
    const hint = databaseSetupHint(error);
    const message =
      error instanceof Error && error.message
        ? `${error.message}${hint}`
        : `Failed to load campaigns.${hint}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_manage_announcements", request);

  if (auth.response) {
    return auth.response;
  }

  const parsed = await parseAnnouncementCampaignWriteRequest(
    request,
    auth.user!.id,
    "/api/admin/announcement/campaigns"
  );

  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const campaign = await createAnnouncementCampaign(parsed.value, auth.user!.id);

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/announcement/campaigns failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create campaign",
      },
      { status: 400 }
    );
  }
}
