import { writeAuditLog } from "@/lib/audit-log";
import type {
  AnnouncementAdminPayload,
  AnnouncementCampaignDetail,
  AnnouncementCampaignListItem,
} from "@/types/announcement";

export const ANNOUNCEMENT_AUDIT_RECORD_ID = 1;

export type AnnouncementAuditEvent = "update" | "force_reshow";

export type AnnouncementAuditValues = {
  event: AnnouncementAuditEvent;
  is_active: boolean;
  display_mode: string;
  display_delay: number;
  popup_version: string;
  media_url: string | null;
  template_title: string | null;
};

function toAuditValues(
  settings: AnnouncementAdminPayload,
  event: AnnouncementAuditEvent
): AnnouncementAuditValues {
  return {
    event,
    is_active: settings.isActive,
    display_mode: settings.displayMode,
    display_delay: settings.displayDelay,
    popup_version: settings.popupVersion,
    media_url: settings.mediaUrl,
    template_title: settings.template?.title ?? null,
  };
}

function serializeAuditValues(values: AnnouncementAuditValues) {
  return JSON.parse(JSON.stringify(values)) as Record<string, unknown>;
}

function auditValuesEqual(left: AnnouncementAuditValues, right: AnnouncementAuditValues) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function logAnnouncementSettingsUpdate(params: {
  adminUserId: number;
  before: AnnouncementAdminPayload;
  after: AnnouncementAdminPayload;
}) {
  const oldValues = toAuditValues(params.before, "update");
  const newValues = toAuditValues(params.after, "update");

  if (auditValuesEqual(oldValues, newValues)) {
    return;
  }

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "announcement_popups",
    recordId: ANNOUNCEMENT_AUDIT_RECORD_ID,
    oldValues: serializeAuditValues(oldValues),
    newValues: serializeAuditValues(newValues),
  });
}

export async function logAnnouncementForceReshow(params: {
  adminUserId: number;
  before: AnnouncementAdminPayload;
  after: AnnouncementAdminPayload;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "announcement_popups",
    recordId: ANNOUNCEMENT_AUDIT_RECORD_ID,
    oldValues: serializeAuditValues(toAuditValues(params.before, "force_reshow")),
    newValues: serializeAuditValues(toAuditValues(params.after, "force_reshow")),
  });
}

export type AnnouncementCampaignAuditEvent =
  | "create"
  | "update"
  | "delete"
  | "toggle_active"
  | "force_reshow";

export type AnnouncementCampaignAuditValues = {
  event: AnnouncementCampaignAuditEvent;
  name: string;
  title: string;
  template_title: string;
  is_active: boolean;
  target_pages: string[];
  frequency_type: string;
  max_views: number;
  priority: number;
  popup_version?: string;
};

function serializeCampaignAuditValues(values: AnnouncementCampaignAuditValues) {
  return JSON.parse(JSON.stringify(values)) as Record<string, unknown>;
}

function campaignAuditValuesEqual(
  left: AnnouncementCampaignAuditValues,
  right: AnnouncementCampaignAuditValues
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toCampaignAuditValues(
  campaign: AnnouncementCampaignListItem | AnnouncementCampaignDetail,
  event: AnnouncementCampaignAuditEvent
): AnnouncementCampaignAuditValues {
  return {
    event,
    name: campaign.name,
    title: campaign.title,
    template_title: campaign.title,
    is_active: campaign.isActive,
    target_pages: campaign.targetPages,
    frequency_type: campaign.frequencyType,
    max_views: campaign.maxViews,
    priority: campaign.priority,
    popup_version: campaign.popupVersion,
  };
}

export async function logAnnouncementCampaignCreated(params: {
  adminUserId: number;
  campaign: AnnouncementCampaignDetail;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "announcement_popups",
    recordId: params.campaign.id,
    newValues: serializeCampaignAuditValues(
      toCampaignAuditValues(params.campaign, "create")
    ),
  });
}

export async function logAnnouncementCampaignUpdated(params: {
  adminUserId: number;
  before: AnnouncementCampaignDetail;
  after: AnnouncementCampaignDetail;
}) {
  const oldValues = toCampaignAuditValues(params.before, "update");
  const newValues = toCampaignAuditValues(params.after, "update");

  if (campaignAuditValuesEqual(oldValues, newValues)) {
    return;
  }

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "announcement_popups",
    recordId: params.after.id,
    oldValues: serializeCampaignAuditValues(oldValues),
    newValues: serializeCampaignAuditValues(newValues),
  });
}

export async function logAnnouncementCampaignDeleted(params: {
  adminUserId: number;
  campaign: AnnouncementCampaignDetail;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "SOFT_DELETE",
    tableName: "announcement_popups",
    recordId: params.campaign.id,
    oldValues: serializeCampaignAuditValues(
      toCampaignAuditValues(params.campaign, "delete")
    ),
  });
}

export async function logAnnouncementCampaignActiveToggled(params: {
  adminUserId: number;
  before: AnnouncementCampaignDetail;
  after: AnnouncementCampaignDetail;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "announcement_popups",
    recordId: params.after.id,
    oldValues: serializeCampaignAuditValues(
      toCampaignAuditValues(params.before, "toggle_active")
    ),
    newValues: serializeCampaignAuditValues(
      toCampaignAuditValues(params.after, "toggle_active")
    ),
  });
}

export async function logAnnouncementCampaignForceReshow(params: {
  adminUserId: number;
  before: AnnouncementCampaignDetail;
  after: AnnouncementCampaignDetail;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "announcement_popups",
    recordId: params.after.id,
    oldValues: serializeCampaignAuditValues(
      toCampaignAuditValues(params.before, "force_reshow")
    ),
    newValues: serializeCampaignAuditValues(
      toCampaignAuditValues(params.after, "force_reshow")
    ),
  });
}
