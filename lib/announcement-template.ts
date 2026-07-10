import { sanitizeOptionalPlainText, sanitizePlainText } from "@/lib/input-sanitization";
import type { AnnouncementTemplate } from "@/types/announcement";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_BUTTON_LABEL = 80;
const MAX_BUTTON_HREF = 500;

export function sanitizeAnnouncementHref(value: unknown): string | null {
  const cleaned = sanitizeOptionalPlainText(value, MAX_BUTTON_HREF);

  if (!cleaned) {
    return null;
  }

  if (cleaned.startsWith("/") && !cleaned.startsWith("//")) {
    return cleaned;
  }

  try {
    const url = new URL(cleaned);

    if (url.protocol === "https:") {
      return cleaned;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildAnnouncementTemplate(input: {
  title: unknown;
  description: unknown;
  buttonLabel: unknown;
  buttonHref: unknown;
}): AnnouncementTemplate | null {
  const title = sanitizePlainText(input.title, MAX_TITLE, true);
  const description = sanitizePlainText(input.description, MAX_DESCRIPTION, true);

  if (!title || !description) {
    return null;
  }

  const buttonLabel = sanitizeOptionalPlainText(input.buttonLabel, MAX_BUTTON_LABEL);
  const buttonHref = sanitizeAnnouncementHref(input.buttonHref);

  if (buttonLabel && !buttonHref) {
    return null;
  }

  if (!buttonLabel && buttonHref) {
    return null;
  }

  return {
    title,
    description,
    buttonLabel,
    buttonHref,
  };
}

export function serializeAnnouncementTemplate(template: AnnouncementTemplate): string {
  return JSON.stringify(template);
}

export function buildAnnouncementMediaAction(input: {
  buttonLabel: unknown;
  buttonHref: unknown;
}): Pick<AnnouncementTemplate, "buttonLabel" | "buttonHref"> | null {
  const buttonHref = sanitizeAnnouncementHref(input.buttonHref);

  if (!buttonHref) {
    return null;
  }

  const buttonLabel =
    sanitizeOptionalPlainText(input.buttonLabel, MAX_BUTTON_LABEL) || "View details";

  return {
    buttonLabel,
    buttonHref,
  };
}

export function serializeAnnouncementMediaAction(
  action: Pick<AnnouncementTemplate, "buttonLabel" | "buttonHref">
): string {
  return JSON.stringify({
    buttonHref: action.buttonHref,
    buttonLabel: action.buttonLabel,
  });
}

export function parseAnnouncementMediaAction(
  raw: string | null | undefined
): Pick<AnnouncementTemplate, "buttonLabel" | "buttonHref"> | null {
  if (!raw?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AnnouncementTemplate>;

    return buildAnnouncementMediaAction({
      buttonLabel: parsed.buttonLabel,
      buttonHref: parsed.buttonHref,
    });
  } catch {
    return null;
  }
}

export function parseAnnouncementTemplate(
  raw: string | null | undefined
): AnnouncementTemplate | null {
  if (!raw?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AnnouncementTemplate>;

    return buildAnnouncementTemplate({
      title: parsed.title,
      description: parsed.description,
      buttonLabel: parsed.buttonLabel,
      buttonHref: parsed.buttonHref,
    });
  } catch {
    return null;
  }
}
