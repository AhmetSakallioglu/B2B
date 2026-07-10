const MAX_TARGET_PAGES = 20;
const MAX_TARGET_PAGE_LENGTH = 120;

export function normalizeAnnouncementTargetPage(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.toUpperCase() === "ALL") {
    return "ALL";
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;

  if (withoutQuery.length > MAX_TARGET_PAGE_LENGTH) {
    return null;
  }

  return withoutQuery.replace(/\/+$/, "") || "/";
}

export function parseAnnouncementTargetPages(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const pages = value
      .map((entry) => (typeof entry === "string" ? normalizeAnnouncementTargetPage(entry) : null))
      .filter((entry): entry is string => Boolean(entry));

    if (pages.length === 0) {
      return null;
    }

    return dedupeTargetPages(pages);
  }

  if (typeof value === "string") {
    const pages = value
      .split(/[\n,]+/)
      .map((entry) => normalizeAnnouncementTargetPage(entry))
      .filter((entry): entry is string => Boolean(entry));

    if (pages.length === 0) {
      return null;
    }

    return dedupeTargetPages(pages);
  }

  return null;
}

function dedupeTargetPages(pages: string[]) {
  const unique = Array.from(new Set(pages));

  if (unique.includes("ALL")) {
    return ["ALL"];
  }

  return unique.slice(0, MAX_TARGET_PAGES);
}

export function serializeAnnouncementTargetPages(pages: string[]) {
  return JSON.stringify(dedupeTargetPages(pages) ?? ["ALL"]);
}

export function readAnnouncementTargetPagesFromDb(value: unknown): string[] {
  if (Array.isArray(value)) {
    const parsed = parseAnnouncementTargetPages(value);
    return parsed ?? ["ALL"];
  }

  if (typeof value === "string") {
    try {
      const json = JSON.parse(value) as unknown;
      const parsed = parseAnnouncementTargetPages(json);
      return parsed ?? ["ALL"];
    } catch {
      const parsed = parseAnnouncementTargetPages(value);
      return parsed ?? ["ALL"];
    }
  }

  return ["ALL"];
}

export function matchesAnnouncementTargetPage(pathname: string, targetPages: string[]) {
  const normalizedPath = pathname.split("?")[0]?.split("#")[0] ?? pathname;

  if (targetPages.includes("ALL")) {
    return true;
  }

  return targetPages.some((target) => {
    if (target === normalizedPath) {
      return true;
    }

    return normalizedPath.startsWith(`${target}/`);
  });
}
