import type {
  AnnouncementFrequencyType,
  AnnouncementPublicPayload,
  PopupHistoryEntry,
  PopupHistoryStore,
} from "@/types/announcement";
import {
  POPUP_HISTORY_STORAGE_KEY,
  POPUP_SESSION_PREFIX,
  SEEN_POPUP_VERSION_STORAGE_KEY,
} from "@/types/announcement";

function popupHistoryKey(popupId: number) {
  return `popup_${popupId}`;
}

function createEmptyEntry(): PopupHistoryEntry {
  return {
    views: 0,
    lastShown: null,
    dismissedVersion: null,
  };
}

export function readPopupHistory(): PopupHistoryStore {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(POPUP_HISTORY_STORAGE_KEY);

    if (!raw) {
      return migrateLegacySeenPopupVersion();
    }

    const parsed = JSON.parse(raw) as PopupHistoryStore;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function migrateLegacySeenPopupVersion(): PopupHistoryStore {
  try {
    const legacyVersion = window.localStorage.getItem(SEEN_POPUP_VERSION_STORAGE_KEY);

    if (!legacyVersion) {
      return {};
    }

    return {
      popup_1: {
        views: 1,
        lastShown: new Date().toISOString(),
        dismissedVersion: legacyVersion,
      },
    };
  } catch {
    return {};
  }
}

export function writePopupHistory(history: PopupHistoryStore) {
  try {
    window.localStorage.setItem(POPUP_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore quota / private browsing failures.
  }
}

function sessionStorageKey(popupId: number, popupVersion: string) {
  return `${POPUP_SESSION_PREFIX}${popupId}_${popupVersion}`;
}

export function wasPopupShownThisSession(popupId: number, popupVersion: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(sessionStorageKey(popupId, popupVersion)) === "1";
  } catch {
    return false;
  }
}

export function markPopupShownThisSession(popupId: number, popupVersion: string) {
  try {
    window.sessionStorage.setItem(sessionStorageKey(popupId, popupVersion), "1");
  } catch {
    // Ignore storage failures.
  }
}

export function shouldDisplayPopup(
  popup: AnnouncementPublicPayload,
  history: PopupHistoryStore
) {
  const entry = history[popupHistoryKey(popup.id)] ?? createEmptyEntry();

  if (popup.frequencyType === "ONCE") {
    if (entry.dismissedVersion === popup.popupVersion) {
      return false;
    }
  }

  if (popup.frequencyType === "EVERY_SESSION") {
    if (wasPopupShownThisSession(popup.id, popup.popupVersion)) {
      return false;
    }
  }

  if (popup.frequencyType === "MAX_LIMIT") {
    if (entry.views >= popup.maxViews) {
      return false;
    }
  }

  return true;
}

export function recordPopupDisplayed(popup: AnnouncementPublicPayload) {
  const history = readPopupHistory();
  const key = popupHistoryKey(popup.id);
  const entry = history[key] ?? createEmptyEntry();

  history[key] = {
    ...entry,
    views: entry.views + 1,
    lastShown: new Date().toISOString(),
  };

  writePopupHistory(history);
  markPopupShownThisSession(popup.id, popup.popupVersion);
}

export function recordPopupDismissed(popup: AnnouncementPublicPayload) {
  const history = readPopupHistory();
  const key = popupHistoryKey(popup.id);
  const entry = history[key] ?? createEmptyEntry();

  history[key] = {
    ...entry,
    dismissedVersion: popup.popupVersion,
  };

  writePopupHistory(history);
  markPopupShownThisSession(popup.id, popup.popupVersion);
}

export function sortPopupsByPriority(popups: AnnouncementPublicPayload[]) {
  return [...popups].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.id - right.id;
  });
}

export function selectEligiblePopup(
  popups: AnnouncementPublicPayload[],
  pathname: string,
  dismissedPopupIds: number[],
  matchesTargetPage: (pathname: string, targetPages: string[]) => boolean
) {
  const history = readPopupHistory();

  return sortPopupsByPriority(popups).find((popup) => {
    if (dismissedPopupIds.includes(popup.id)) {
      return false;
    }

    if (!matchesTargetPage(pathname, popup.targetPages)) {
      return false;
    }

    return shouldDisplayPopup(popup, history);
  });
}

export function parseAnnouncementFrequencyType(value: unknown): AnnouncementFrequencyType | null {
  if (value === "ONCE" || value === "EVERY_SESSION" || value === "MAX_LIMIT") {
    return value;
  }

  return null;
}

export function parseAnnouncementMaxViews(
  value: unknown,
  frequencyType: AnnouncementFrequencyType
): number | null {
  if (frequencyType !== "MAX_LIMIT") {
    return 1;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    return null;
  }

  return parsed;
}

export function parseAnnouncementPriority(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000) {
    return null;
  }

  return parsed;
}
