import { randomUUID } from "crypto";
import { toIsoTimestamp } from "@/lib/to-iso-timestamp";
import {
  logAnnouncementForceReshow,
  logAnnouncementSettingsUpdate,
} from "@/lib/announcement-audit-log";
import {
  parseAnnouncementFrequencyType,
  parseAnnouncementMaxViews,
  parseAnnouncementPriority,
} from "@/lib/announcement-popup-history";
import {
  matchesAnnouncementTargetPage,
  parseAnnouncementTargetPages,
  readAnnouncementTargetPagesFromDb,
  serializeAnnouncementTargetPages,
} from "@/lib/announcement-targeting";
import { query } from "@/lib/db";
import {
  parseAnnouncementTemplate,
  parseAnnouncementMediaAction,
  serializeAnnouncementTemplate,
} from "@/lib/announcement-template";
import {
  inferAnnouncementMediaType,
  deleteAnnouncementMedia,
} from "@/lib/save-announcement-media";
import {
  ANNOUNCEMENT_MAX_DISPLAY_DELAY_SECONDS,
  type AnnouncementAdminPayload,
  type AnnouncementDisplayMode,
  type AnnouncementFrequencyType,
  type AnnouncementPopupRecord,
  type AnnouncementPublicPayload,
  type AnnouncementTemplate,
} from "@/types/announcement";

type AnnouncementRow = AnnouncementPopupRecord & {
  target_pages: unknown;
};

export function createPopupVersion() {
  return randomUUID();
}

export function parseDisplayDelay(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > ANNOUNCEMENT_MAX_DISPLAY_DELAY_SECONDS) {
    return null;
  }

  return parsed;
}

function mapRowToPublic(row: AnnouncementRow): AnnouncementPublicPayload {
  const template =
    row.display_mode === "template" ? parseAnnouncementTemplate(row.template_html) : null;

  const mediaType =
    row.display_mode === "media" ? inferAnnouncementMediaType(row.media_url) : null;

  const mediaAction =
    row.display_mode === "media" ? parseAnnouncementMediaAction(row.template_html) : null;

  return {
    id: row.id,
    displayMode: row.display_mode,
    mediaUrl: row.media_url,
    mediaType,
    template,
    actionButton: mediaAction?.buttonHref
      ? { label: mediaAction.buttonLabel ?? "View details", href: mediaAction.buttonHref }
      : null,
    displayDelay: row.display_delay,
    popupVersion: row.popup_version,
    targetPages: readAnnouncementTargetPagesFromDb(row.target_pages),
    frequencyType: row.frequency_type,
    maxViews: row.max_views,
    priority: row.priority,
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

function isValidPublicPopup(payload: AnnouncementPublicPayload) {
  if (payload.displayMode === "media") {
    return Boolean(payload.mediaUrl && payload.mediaType);
  }

  if (payload.displayMode === "template") {
    return Boolean(payload.template);
  }

  return false;
}

const ANNOUNCEMENT_SELECT = `
  id,
  name,
  is_active,
  display_mode,
  media_url,
  template_html,
  display_delay,
  popup_version,
  target_pages,
  frequency_type,
  max_views,
  priority,
  updated_at
`;

export async function getAnnouncementSettings(): Promise<AnnouncementAdminPayload | null> {
  const result = await query<AnnouncementRow>(
    `
      SELECT ${ANNOUNCEMENT_SELECT}
      FROM announcement_popups
      WHERE id = 1
    `
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const publicPayload = mapRowToPublic(row);

  return {
    isActive: row.is_active,
    name: row.name,
    ...publicPayload,
  };
}

export async function getActiveAnnouncementsForCustomer(
  pathname?: string
): Promise<AnnouncementPublicPayload[]> {
  const result = await query<AnnouncementRow>(
    `
      SELECT ${ANNOUNCEMENT_SELECT}
      FROM announcement_popups
      WHERE is_active = true
      ORDER BY priority DESC, id ASC
    `
  );

  return result.rows
    .map(mapRowToPublic)
    .filter(isValidPublicPopup)
    .filter((popup) => {
      if (!pathname) {
        return true;
      }

      return matchesAnnouncementTargetPage(pathname, popup.targetPages);
    });
}

export async function getActiveAnnouncementForCustomer(): Promise<AnnouncementPublicPayload | null> {
  const announcements = await getActiveAnnouncementsForCustomer();
  return announcements[0] ?? null;
}

function hasAnnouncementContentChanged(input: {
  previousDisplayMode: AnnouncementDisplayMode;
  previousMediaUrl: string | null;
  previousTemplateHtml: string | null;
  displayMode: AnnouncementDisplayMode;
  mediaUrl: string | null;
  templateHtml: string | null;
}) {
  return (
    input.previousDisplayMode !== input.displayMode ||
    input.previousMediaUrl !== input.mediaUrl ||
    input.previousTemplateHtml !== input.templateHtml
  );
}

export async function updateAnnouncementSettings(input: {
  adminUserId: number;
  isActive: boolean;
  displayMode: AnnouncementDisplayMode;
  displayDelay: number;
  template: AnnouncementTemplate | null;
  mediaUrl: string | null;
  removeMedia: boolean;
  name: string;
  targetPages: string[];
  frequencyType: AnnouncementFrequencyType;
  maxViews: number;
  priority: number;
}) {
  const beforeSettings = await getAnnouncementSettings();

  if (!beforeSettings) {
    throw new Error("Announcement settings are not initialized");
  }

  const currentResult = await query<AnnouncementRow>(
    `
      SELECT ${ANNOUNCEMENT_SELECT}
      FROM announcement_popups
      WHERE id = 1
    `
  );

  const current = currentResult.rows[0];

  if (!current) {
    throw new Error("Announcement settings are not initialized");
  }

  if (input.displayMode === "template" && !input.template) {
    throw new Error("Title and description are required for template mode");
  }

  if (input.displayMode === "media" && !input.mediaUrl) {
    throw new Error("Upload an image or PDF for media mode");
  }

  const templateHtml =
    input.displayMode === "template" && input.template
      ? serializeAnnouncementTemplate(input.template)
      : null;

  const nextMediaUrl = input.displayMode === "media" ? input.mediaUrl : null;
  const previousMediaUrl = current.media_url;

  if (input.removeMedia || (input.displayMode === "template" && previousMediaUrl)) {
    await deleteAnnouncementMedia(previousMediaUrl);
  } else if (previousMediaUrl && nextMediaUrl && previousMediaUrl !== nextMediaUrl) {
    await deleteAnnouncementMedia(previousMediaUrl);
  }

  const shouldBumpVersion = hasAnnouncementContentChanged({
    previousDisplayMode: current.display_mode,
    previousMediaUrl,
    previousTemplateHtml: current.template_html,
    displayMode: input.displayMode,
    mediaUrl: nextMediaUrl,
    templateHtml,
  });

  const popupVersion = shouldBumpVersion ? createPopupVersion() : current.popup_version;

  await query(
    `
      UPDATE announcement_popups
      SET
        name = $1,
        is_active = $2,
        display_mode = $3,
        media_url = $4,
        template_html = $5,
        display_delay = $6,
        popup_version = $7,
        target_pages = $8::jsonb,
        frequency_type = $9,
        max_views = $10,
        priority = $11,
        updated_at = NOW()
      WHERE id = 1
    `,
    [
      input.name,
      input.isActive,
      input.displayMode,
      nextMediaUrl,
      templateHtml,
      input.displayDelay,
      popupVersion,
      serializeAnnouncementTargetPages(input.targetPages),
      input.frequencyType,
      input.maxViews,
      input.priority,
    ]
  );

  const afterSettings = await getAnnouncementSettings();

  if (afterSettings) {
    await logAnnouncementSettingsUpdate({
      adminUserId: input.adminUserId,
      before: beforeSettings,
      after: afterSettings,
    });
  }

  return afterSettings;
}

export async function forceReshowAnnouncementToAllUsers(adminUserId: number) {
  const beforeSettings = await getAnnouncementSettings();

  if (!beforeSettings) {
    throw new Error("Announcement settings are not initialized");
  }

  const popupVersion = createPopupVersion();

  await query(
    `
      UPDATE announcement_popups
      SET
        popup_version = $1,
        updated_at = NOW()
      WHERE id = 1
    `,
    [popupVersion]
  );

  const afterSettings = await getAnnouncementSettings();

  if (afterSettings) {
    await logAnnouncementForceReshow({
      adminUserId,
      before: beforeSettings,
      after: afterSettings,
    });
  }

  return afterSettings;
}

export function parseAnnouncementEngineSettings(input: {
  name: unknown;
  targetPages: unknown;
  frequencyType: unknown;
  maxViews: unknown;
  priority: unknown;
}) {
  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 120)
      : "Dealer announcement";

  const targetPages = parseAnnouncementTargetPages(input.targetPages);

  if (!targetPages) {
    return null;
  }

  const frequencyType = parseAnnouncementFrequencyType(input.frequencyType);

  if (!frequencyType) {
    return null;
  }

  const maxViews = parseAnnouncementMaxViews(input.maxViews, frequencyType);

  if (maxViews === null) {
    return null;
  }

  const priority = parseAnnouncementPriority(input.priority);

  if (priority === null) {
    return null;
  }

  return {
    name,
    targetPages,
    frequencyType,
    maxViews,
    priority,
  };
}
