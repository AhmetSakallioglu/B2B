import { randomUUID } from "crypto";
import {
  parseAnnouncementFrequencyType,
  parseAnnouncementMaxViews,
  parseAnnouncementPriority,
} from "@/lib/announcement-popup-history";
import {
  parseAnnouncementTargetPages,
  readAnnouncementTargetPagesFromDb,
  serializeAnnouncementTargetPages,
} from "@/lib/announcement-targeting";
import {
  buildAnnouncementTemplate,
  buildAnnouncementMediaAction,
  serializeAnnouncementTemplate,
  serializeAnnouncementMediaAction,
} from "@/lib/announcement-template";
import { query } from "@/lib/db";
import { parseDisplayDelay, createPopupVersion } from "@/lib/announcement";
import {
  logAnnouncementCampaignActiveToggled,
  logAnnouncementCampaignCreated,
  logAnnouncementCampaignDeleted,
  logAnnouncementCampaignForceReshow,
  logAnnouncementCampaignUpdated,
} from "@/lib/announcement-audit-log";
import { inferAnnouncementMediaType, deleteAnnouncementMedia } from "@/lib/save-announcement-media";
import { toIsoTimestamp } from "@/lib/to-iso-timestamp";
import type {
  AnnouncementCampaignDetail,
  AnnouncementCampaignListItem,
  AnnouncementCampaignWriteInput,
  AnnouncementDisplayMode,
  AnnouncementPopupRecord,
} from "@/types/announcement";

type CampaignRow = AnnouncementPopupRecord & {
  target_pages: unknown;
};

const CAMPAIGN_SELECT = `
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

function parseTemplateFields(row: CampaignRow) {
  if (!row.template_html) {
    return {
      title: row.name,
      body: "",
      actionUrl: null as string | null,
      buttonLabel: null as string | null,
    };
  }

  try {
    const parsed = JSON.parse(row.template_html) as {
      title?: string;
      description?: string;
      buttonHref?: string | null;
      buttonLabel?: string | null;
    };

    return {
      title: parsed.title ?? row.name,
      body: parsed.description ?? "",
      actionUrl: parsed.buttonHref ?? null,
      buttonLabel: parsed.buttonLabel ?? null,
    };
  } catch {
    return {
      title: row.name,
      body: "",
      actionUrl: null,
      buttonLabel: null,
    };
  }
}

function mapRowToListItem(row: CampaignRow): AnnouncementCampaignListItem {
  const template = parseTemplateFields(row);
  const mediaType =
    row.display_mode === "media" ? inferAnnouncementMediaType(row.media_url) : null;

  return {
    id: row.id,
    name: row.name,
    title: row.display_mode === "media" ? row.name : template.title,
    isActive: row.is_active,
    displayMode: row.display_mode,
    mediaUrl: row.media_url,
    mediaType,
    targetPages: readAnnouncementTargetPagesFromDb(row.target_pages),
    frequencyType: row.frequency_type,
    maxViews: row.max_views,
    priority: row.priority,
    displayDelay: row.display_delay,
    popupVersion: row.popup_version,
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

function mapRowToDetail(row: CampaignRow): AnnouncementCampaignDetail {
  const template = parseTemplateFields(row);

  return {
    ...mapRowToListItem(row),
    body: template.body,
    actionUrl: template.actionUrl,
    buttonLabel: template.buttonLabel,
  };
}

function buildCampaignStorageHtml(input: AnnouncementCampaignWriteInput) {
  if (input.displayMode === "template") {
    const template = buildAnnouncementTemplate({
      title: input.title,
      description: input.body,
      buttonLabel: input.buttonLabel ?? (input.actionUrl ? "View details" : null),
      buttonHref: input.actionUrl,
    });

    if (!template) {
      throw new Error("Title and body are required");
    }

    return serializeAnnouncementTemplate(template);
  }

  const mediaAction = buildAnnouncementMediaAction({
    buttonLabel: input.buttonLabel,
    buttonHref: input.actionUrl,
  });

  return mediaAction ? serializeAnnouncementMediaAction(mediaAction) : null;
}

function resolveCampaignMediaUrl(input: AnnouncementCampaignWriteInput) {
  return input.displayMode === "media" ? input.mediaUrl : null;
}

function hasCampaignContentChanged(
  current: CampaignRow,
  next: {
    displayMode: AnnouncementDisplayMode;
    templateHtml: string | null;
    mediaUrl: string | null;
  }
) {
  return (
    current.display_mode !== next.displayMode ||
    current.media_url !== next.mediaUrl ||
    current.template_html !== next.templateHtml
  );
}

async function reconcileCampaignMedia(
  current: CampaignRow,
  input: AnnouncementCampaignWriteInput,
  nextMediaUrl: string | null
) {
  const previousMediaUrl = current.media_url;

  if (input.removeMedia || (input.displayMode === "template" && previousMediaUrl)) {
    await deleteAnnouncementMedia(previousMediaUrl);
    return;
  }

  if (previousMediaUrl && nextMediaUrl && previousMediaUrl !== nextMediaUrl) {
    await deleteAnnouncementMedia(previousMediaUrl);
  }
}

export async function listAnnouncementCampaigns(): Promise<AnnouncementCampaignListItem[]> {
  const result = await query<CampaignRow>(
    `
      SELECT ${CAMPAIGN_SELECT}
      FROM announcement_popups
      ORDER BY priority DESC, id ASC
    `
  );

  return result.rows.map(mapRowToListItem);
}

export async function getAnnouncementCampaignById(
  id: number
): Promise<AnnouncementCampaignDetail | null> {
  const result = await query<CampaignRow>(
    `
      SELECT ${CAMPAIGN_SELECT}
      FROM announcement_popups
      WHERE id = $1
    `,
    [id]
  );

  const row = result.rows[0];
  return row ? mapRowToDetail(row) : null;
}

export async function createAnnouncementCampaign(
  input: AnnouncementCampaignWriteInput,
  adminUserId: number
) {
  const templateHtml = buildCampaignStorageHtml(input);
  const mediaUrl = resolveCampaignMediaUrl(input);
  const popupVersion = createPopupVersion();

  if (input.displayMode === "media" && !mediaUrl) {
    throw new Error("Upload an image or PDF for media campaigns");
  }

  const result = await query<{ id: number }>(
    `
      INSERT INTO announcement_popups (
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
        priority
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
      RETURNING id
    `,
    [
      input.name,
      input.isActive,
      input.displayMode,
      mediaUrl,
      templateHtml,
      input.displayDelay,
      popupVersion,
      serializeAnnouncementTargetPages(input.targetPages),
      input.frequencyType,
      input.maxViews,
      input.priority,
    ]
  );

  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error("Failed to create campaign");
  }

  const campaign = await getAnnouncementCampaignById(id);

  if (campaign) {
    await logAnnouncementCampaignCreated({ adminUserId, campaign });
  }

  return campaign;
}

export async function updateAnnouncementCampaign(
  id: number,
  input: AnnouncementCampaignWriteInput,
  adminUserId: number
) {
  const currentResult = await query<CampaignRow>(
    `
      SELECT ${CAMPAIGN_SELECT}
      FROM announcement_popups
      WHERE id = $1
    `,
    [id]
  );

  const current = currentResult.rows[0];

  if (!current) {
    return null;
  }

  const before = mapRowToDetail(current);
  const templateHtml = buildCampaignStorageHtml(input);
  const nextMediaUrl = resolveCampaignMediaUrl(input);

  if (input.displayMode === "media" && !nextMediaUrl) {
    throw new Error("Upload an image or PDF for media campaigns");
  }

  const popupVersion = hasCampaignContentChanged(current, {
    displayMode: input.displayMode,
    templateHtml,
    mediaUrl: nextMediaUrl,
  })
    ? createPopupVersion()
    : current.popup_version;

  await reconcileCampaignMedia(current, input, nextMediaUrl);

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
      WHERE id = $12
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
      id,
    ]
  );

  const after = await getAnnouncementCampaignById(id);

  if (after) {
    await logAnnouncementCampaignUpdated({ adminUserId, before, after });
  }

  return after;
}

export async function toggleAnnouncementCampaignActive(
  id: number,
  isActive: boolean,
  adminUserId: number
) {
  const before = await getAnnouncementCampaignById(id);

  if (!before) {
    return null;
  }

  const result = await query<{ id: number }>(
    `
      UPDATE announcement_popups
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `,
    [isActive, id]
  );

  if (!result.rows[0]) {
    return null;
  }

  const after = await getAnnouncementCampaignById(id);

  if (after) {
    await logAnnouncementCampaignActiveToggled({ adminUserId, before, after });
  }

  return after;
}

export async function deleteAnnouncementCampaign(id: number, adminUserId: number) {
  const current = await getAnnouncementCampaignById(id);

  if (!current) {
    return false;
  }

  const rowResult = await query<{ media_url: string | null }>(
    `SELECT media_url FROM announcement_popups WHERE id = $1`,
    [id]
  );

  await query(`DELETE FROM announcement_popups WHERE id = $1`, [id]);
  await deleteAnnouncementMedia(rowResult.rows[0]?.media_url);

  await logAnnouncementCampaignDeleted({ adminUserId, campaign: current });

  return true;
}

export async function forceReshowAnnouncementCampaign(id: number, adminUserId: number) {
  const before = await getAnnouncementCampaignById(id);

  if (!before) {
    return null;
  }

  const popupVersion = randomUUID();

  const result = await query<{ id: number }>(
    `
      UPDATE announcement_popups
      SET popup_version = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `,
    [popupVersion, id]
  );

  if (!result.rows[0]) {
    return null;
  }

  const after = await getAnnouncementCampaignById(id);

  if (after) {
    await logAnnouncementCampaignForceReshow({ adminUserId, before, after });
  }

  return after;
}

export function buildCampaignWriteInputFromSanitized(input: {
  name: string;
  title: string;
  body: string;
  actionUrl: string | null;
  buttonLabel: string | null;
  displayMode?: AnnouncementDisplayMode;
  mediaUrl?: string | null;
  removeMedia?: boolean;
  targetPages: string[];
  frequencyType: ReturnType<typeof parseAnnouncementFrequencyType>;
  maxViews: number | null;
  priority: number | null;
  displayDelay: number | null;
  isActive: boolean;
}): AnnouncementCampaignWriteInput | null {
  if (!input.frequencyType || input.maxViews === null || input.priority === null) {
    return null;
  }

  const displayDelay = input.displayDelay ?? 3;
  const targetPages = parseAnnouncementTargetPages(input.targetPages);

  if (!targetPages) {
    return null;
  }

  return {
    name: input.name,
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl,
    buttonLabel: input.buttonLabel,
    displayMode: input.displayMode ?? "template",
    mediaUrl: input.mediaUrl ?? null,
    removeMedia: input.removeMedia ?? false,
    targetPages,
    frequencyType: input.frequencyType,
    maxViews: input.maxViews,
    priority: input.priority,
    displayDelay,
    isActive: input.isActive,
  };
}
