import { NextResponse } from "next/server";
import type { AnnouncementCampaignWriteInput } from "@/types/announcement";
import {
  buildCampaignWriteInputFromSanitized,
} from "@/lib/announcement-campaigns";
import {
  invalidAnnouncementCampaignResponse,
  parseSanitizedAnnouncementCampaignBody,
  type SanitizedAnnouncementCampaignInput,
} from "@/lib/admin-search-sanitization";
import { saveAnnouncementMedia } from "@/lib/save-announcement-media";
import type { AnnouncementDisplayMode } from "@/types/announcement";

function parseDisplayMode(value: FormDataEntryValue | null): AnnouncementDisplayMode | null {
  if (value === "media" || value === "template") {
    return value;
  }

  return null;
}

function parseBoolean(value: FormDataEntryValue | null) {
  if (value === "true" || value === "1" || value === "on") {
    return true;
  }

  if (value === "false" || value === "0" || value === "off") {
    return false;
  }

  return null;
}

function parseTargetPagesField(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string");
    }
  } catch {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
}

function formDataToRecord(formData: FormData) {
  const record: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }

  record.targetPages = parseTargetPagesField(formData.get("targetPages"));
  record.displayMode = formData.get("displayMode");
  record.frequencyType = formData.get("frequencyType");
  record.maxViews = formData.get("maxViews");
  record.priority = formData.get("priority");
  record.displayDelay = formData.get("displayDelay");
  record.isActive = formData.get("isActive");

  return record;
}

async function buildWriteInputFromSanitized(
  sanitized: SanitizedAnnouncementCampaignInput,
  options: {
    displayMode: AnnouncementDisplayMode;
    mediaUrl: string | null;
    removeMedia: boolean;
  }
): Promise<AnnouncementCampaignWriteInput | null> {
  const base = buildCampaignWriteInputFromSanitized(sanitized);

  if (!base) {
    return null;
  }

  if (options.displayMode === "media" && !options.mediaUrl) {
    return null;
  }

  if (options.displayMode === "template" && !sanitized.body.trim()) {
    return null;
  }

  return {
    ...base,
    displayMode: options.displayMode,
    mediaUrl: options.displayMode === "media" ? options.mediaUrl : null,
    removeMedia: options.removeMedia,
  };
}

export async function parseAnnouncementCampaignWriteRequest(
  request: Request,
  adminUserId: number,
  route: string,
  options?: { existingMediaUrl?: string | null }
): Promise<
  | { ok: true; value: AnnouncementCampaignWriteInput }
  | { ok: false; response: Response }
> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const displayMode = parseDisplayMode(formData.get("displayMode"));

    if (!displayMode) {
      return { ok: false, response: invalidAnnouncementCampaignResponse("Invalid display mode") };
    }

    const removeMedia = parseBoolean(formData.get("removeMedia")) === true;
    const file = formData.get("file");
    let mediaUrl = options?.existingMediaUrl ?? null;

    if (file instanceof File && file.size > 0) {
      try {
        mediaUrl = await saveAnnouncementMedia(file);
      } catch (uploadError) {
        return {
          ok: false,
          response: NextResponse.json(
            {
              error:
                uploadError instanceof Error
                  ? uploadError.message
                  : "Failed to upload announcement media",
            },
            { status: 400 }
          ),
        };
      }
    } else if (removeMedia) {
      mediaUrl = null;
    }

    const record = formDataToRecord(formData);
    const parsed = await parseSanitizedAnnouncementCampaignBody(
      request,
      adminUserId,
      route,
      record,
      { displayMode, requireBody: displayMode === "template" }
    );

    if (!parsed.ok) {
      return parsed;
    }

    const writeInput = await buildWriteInputFromSanitized(parsed.value, {
      displayMode,
      mediaUrl: displayMode === "media" ? mediaUrl : null,
      removeMedia,
    });

    if (!writeInput) {
      return {
        ok: false,
        response: invalidAnnouncementCampaignResponse(
          displayMode === "media"
            ? "Upload a JPG, PNG, or PDF for media campaigns"
            : "Invalid campaign payload"
        ),
      };
    }

    return { ok: true, value: writeInput };
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { ok: false, response: invalidAnnouncementCampaignResponse("Invalid JSON payload") };
  }

  const candidate =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const displayMode =
    candidate?.displayMode === "media" || candidate?.displayMode === "template"
      ? candidate.displayMode
      : "template";

  const parsed = await parseSanitizedAnnouncementCampaignBody(
    request,
    adminUserId,
    route,
    body,
    { displayMode, requireBody: displayMode === "template" }
  );

  if (!parsed.ok) {
    return parsed;
  }

  const writeInput = await buildWriteInputFromSanitized(parsed.value, {
    displayMode,
    mediaUrl: displayMode === "media" ? options?.existingMediaUrl ?? null : null,
    removeMedia: false,
  });

  if (!writeInput) {
    return { ok: false, response: invalidAnnouncementCampaignResponse() };
  }

  return { ok: true, value: writeInput };
}
