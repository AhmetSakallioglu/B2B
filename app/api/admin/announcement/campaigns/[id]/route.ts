import { NextResponse } from "next/server";
import {
  deleteAnnouncementCampaign,
  forceReshowAnnouncementCampaign,
  getAnnouncementCampaignById,
  toggleAnnouncementCampaignActive,
  updateAnnouncementCampaign,
} from "@/lib/announcement-campaigns";
import { parseAnnouncementCampaignWriteRequest } from "@/lib/announcement-campaign-request";
import { requireAdminPermission } from "@/lib/api-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseCampaignId(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_announcements");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const campaignId = parseCampaignId(id);

  if (!campaignId) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  try {
    const campaign = await getAnnouncementCampaignById(campaignId);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error(`GET /api/admin/announcement/campaigns/${campaignId} failed:`, error);
    return NextResponse.json({ error: "Failed to load campaign" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_announcements", request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const campaignId = parseCampaignId(id);

  if (!campaignId) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (
      body &&
      typeof body === "object" &&
      "isActive" in body &&
      Object.keys(body as Record<string, unknown>).length === 1
    ) {
      const isActive = (body as { isActive?: unknown }).isActive;

      if (typeof isActive !== "boolean") {
        return NextResponse.json({ error: "Invalid active state" }, { status: 400 });
      }

      const campaign = await toggleAnnouncementCampaignActive(campaignId, isActive, auth.user!.id);

      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      return NextResponse.json({ campaign });
    }

    if (
      body &&
      typeof body === "object" &&
      "forceReshow" in body &&
      (body as { forceReshow?: unknown }).forceReshow === true
    ) {
      const campaign = await forceReshowAnnouncementCampaign(campaignId, auth.user!.id);

      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      return NextResponse.json({ campaign });
    }
  }

  const existing = await getAnnouncementCampaignById(campaignId);

  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const parsed = await parseAnnouncementCampaignWriteRequest(
    request,
    auth.user!.id,
    `/api/admin/announcement/campaigns/${campaignId}`,
    { existingMediaUrl: existing.mediaUrl }
  );

  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const campaign = await updateAnnouncementCampaign(campaignId, parsed.value, auth.user!.id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error(`PATCH /api/admin/announcement/campaigns/${campaignId} failed:`, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update campaign",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_announcements");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const campaignId = parseCampaignId(id);

  if (!campaignId) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  const deleted = await deleteAnnouncementCampaign(campaignId, auth.user!.id);

  if (!deleted) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
