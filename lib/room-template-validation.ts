import { parseCartLineItemsPayload } from "@/lib/cart-items";
import { sanitizePlainText } from "@/lib/input-sanitization";
import type { CartLineInput } from "@/lib/cart-items";

export const ROOM_TEMPLATE_NAME_MAX_LENGTH = 150;
export const ROOM_TEMPLATE_MULTIPLIER_MIN = 1;
export const ROOM_TEMPLATE_MULTIPLIER_MAX = 999;

export function sanitizeRoomTemplateName(value: unknown): string | null {
  const cleaned = sanitizePlainText(value, ROOM_TEMPLATE_NAME_MAX_LENGTH, true);

  if (!cleaned || cleaned.length < 2) {
    return null;
  }

  return cleaned;
}

export function parseSaveRoomTemplateBody(body: unknown): {
  templateName: string;
  items: CartLineInput[];
} | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const templateName = sanitizeRoomTemplateName(candidate.templateName);
  const items = parseCartLineItemsPayload(candidate.items);

  if (!templateName || !items) {
    return null;
  }

  return { templateName, items };
}

export function parseRoomTemplateMultiplier(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  if (value < ROOM_TEMPLATE_MULTIPLIER_MIN || value > ROOM_TEMPLATE_MULTIPLIER_MAX) {
    return null;
  }

  return value;
}

export function parseAddTemplateToCartBody(body: unknown): { multiplier: number } | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const multiplier = parseRoomTemplateMultiplier(candidate.multiplier);

  if (multiplier === null) {
    return null;
  }

  return { multiplier };
}
