export type AnnouncementDisplayMode = "media" | "template";

export type AnnouncementMediaType = "image" | "pdf";

export type AnnouncementFrequencyType = "ONCE" | "EVERY_SESSION" | "MAX_LIMIT";

export type AnnouncementTemplate = {
  title: string;
  description: string;
  buttonLabel: string | null;
  buttonHref: string | null;
};

export type AnnouncementActionButton = {
  label: string;
  href: string;
};

export type AnnouncementPopupRecord = {
  id: number;
  name: string;
  is_active: boolean;
  display_mode: AnnouncementDisplayMode;
  media_url: string | null;
  template_html: string | null;
  display_delay: number;
  popup_version: string;
  target_pages: string[];
  frequency_type: AnnouncementFrequencyType;
  max_views: number;
  priority: number;
  updated_at: Date;
};

export type AnnouncementPublicPayload = {
  id: number;
  displayMode: AnnouncementDisplayMode;
  mediaUrl: string | null;
  mediaType: AnnouncementMediaType | null;
  template: AnnouncementTemplate | null;
  actionButton: AnnouncementActionButton | null;
  displayDelay: number;
  popupVersion: string;
  targetPages: string[];
  frequencyType: AnnouncementFrequencyType;
  maxViews: number;
  priority: number;
  updatedAt: string;
};

export type AnnouncementAdminPayload = AnnouncementPublicPayload & {
  isActive: boolean;
  name: string;
};

export const POPUP_HISTORY_STORAGE_KEY = "cabinetto_popup_history";

export const POPUP_SESSION_PREFIX = "cabinetto_popup_session_";

/** @deprecated Legacy single-popup version key — kept for one-time migration reads. */
export const SEEN_POPUP_VERSION_STORAGE_KEY = "seen_popup_version";

export const ANNOUNCEMENT_MAX_DISPLAY_DELAY_SECONDS = 120;

export const ANNOUNCEMENT_MAX_VIEWS = 100;

export const ANNOUNCEMENT_TARGET_PAGE_OPTIONS = [
  { value: "ALL", label: "All dealer pages" },
  { value: "/catalog", label: "Catalog" },
  { value: "/cart", label: "Cart" },
  { value: "/checkout", label: "Checkout" },
  { value: "/orders", label: "Orders" },
  { value: "/account", label: "Account hub" },
  { value: "/account/quotes", label: "Saved quotes" },
] as const;

export type PopupHistoryEntry = {
  views: number;
  lastShown: string | null;
  dismissedVersion: string | null;
};

export type PopupHistoryStore = Record<string, PopupHistoryEntry>;

export type AnnouncementCampaignListItem = {
  id: number;
  name: string;
  title: string;
  isActive: boolean;
  displayMode: AnnouncementDisplayMode;
  mediaUrl: string | null;
  mediaType: AnnouncementMediaType | null;
  targetPages: string[];
  frequencyType: AnnouncementFrequencyType;
  maxViews: number;
  priority: number;
  displayDelay: number;
  popupVersion: string;
  updatedAt: string;
};

export type AnnouncementCampaignDetail = AnnouncementCampaignListItem & {
  body: string;
  actionUrl: string | null;
  buttonLabel: string | null;
};

export type AnnouncementCampaignWriteInput = {
  name: string;
  title: string;
  body: string;
  actionUrl: string | null;
  buttonLabel: string | null;
  displayMode: AnnouncementDisplayMode;
  mediaUrl: string | null;
  removeMedia: boolean;
  targetPages: string[];
  frequencyType: AnnouncementFrequencyType;
  maxViews: number;
  priority: number;
  displayDelay: number;
  isActive: boolean;
};

export const ANNOUNCEMENT_FREQUENCY_LABELS: Record<AnnouncementFrequencyType, string> = {
  ONCE: "Once per version",
  EVERY_SESSION: "Each session",
  MAX_LIMIT: "View limit",
};
