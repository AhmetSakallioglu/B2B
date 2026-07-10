import { NextResponse } from "next/server";
import {
  buildAnnouncementTemplate,
} from "@/lib/announcement-template";
import {
  getAnnouncementSettings,
  parseAnnouncementEngineSettings,
  parseDisplayDelay,
  updateAnnouncementSettings,
} from "@/lib/announcement";
import { requireAdminPermission } from "@/lib/api-auth";
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

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_manage_announcements");

  if (auth.response) {
    return auth.response;
  }

  const current = await getAnnouncementSettings();

  if (!current) {
    return NextResponse.json({ error: "Announcement settings are not initialized" }, { status: 500 });
  }

  const formData = await request.formData();
  const isActive = parseBoolean(formData.get("isActive"));
  const displayMode = parseDisplayMode(formData.get("displayMode"));
  const displayDelay = parseDisplayDelay(formData.get("displayDelay"));
  const removeMedia = parseBoolean(formData.get("removeMedia")) === true;

  if (isActive === null || !displayMode || displayDelay === null) {
    return NextResponse.json({ error: "Invalid announcement settings payload" }, { status: 400 });
  }

  let mediaUrl = current.mediaUrl;

  const file = formData.get("file");

  if (file instanceof File && file.size > 0) {
    try {
      mediaUrl = await saveAnnouncementMedia(file);
    } catch (uploadError) {
      return NextResponse.json(
        {
          error:
            uploadError instanceof Error ? uploadError.message : "Failed to upload announcement media",
        },
        { status: 400 }
      );
    }
  } else if (removeMedia) {
    mediaUrl = null;
  }

  const template =
    displayMode === "template"
      ? buildAnnouncementTemplate({
          title: formData.get("title"),
          description: formData.get("description"),
          buttonLabel: formData.get("buttonLabel"),
          buttonHref: formData.get("buttonHref"),
        })
      : null;

  if (displayMode === "template" && !template) {
    return NextResponse.json(
      { error: "Title and description are required. Button label and link must be provided together." },
      { status: 400 }
    );
  }

  const engineSettings = parseAnnouncementEngineSettings({
    name: formData.get("name"),
    targetPages: formData.get("targetPages"),
    frequencyType: formData.get("frequencyType"),
    maxViews: formData.get("maxViews"),
    priority: formData.get("priority"),
  });

  if (!engineSettings) {
    return NextResponse.json({ error: "Invalid targeting or frequency settings" }, { status: 400 });
  }

  try {
    const settings = await updateAnnouncementSettings({
      adminUserId: auth.user!.id,
      isActive,
      displayMode,
      displayDelay,
      template,
      mediaUrl,
      removeMedia,
      ...engineSettings,
    });

    return NextResponse.json({ settings });
  } catch (updateError) {
    return NextResponse.json(
      {
        error:
          updateError instanceof Error
            ? updateError.message
            : "Failed to update announcement settings",
      },
      { status: 400 }
    );
  }
}
