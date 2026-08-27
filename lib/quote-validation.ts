import { parseCartLineItemsPayload } from "@/lib/cart-items";
import { sanitizePlainText } from "@/lib/input-sanitization";
import type { CartLineInput } from "@/lib/cart-items";

export const QUOTE_NAME_MAX_LENGTH = 120;
export const QUOTE_STATUSES = ["draft", "pending_approval", "archived"] as const;
export const OPEN_QUOTE_STATUSES = ["draft", "pending_approval"] as const;
export const OPEN_QUOTE_STATUS_SQL = "('draft', 'pending_approval')";

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type OpenQuoteStatus = (typeof OPEN_QUOTE_STATUSES)[number];

export function isArchivedQuoteStatus(status: QuoteStatus) {
  return status === "archived";
}

export function sanitizeQuoteName(value: unknown): string | null {
  const cleaned = sanitizePlainText(value, QUOTE_NAME_MAX_LENGTH, true);

  if (!cleaned || cleaned.length < 2) {
    return null;
  }

  return cleaned;
}

export function parseSaveQuoteBody(body: unknown): {
  quoteName: string;
  items: CartLineInput[];
} | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const quoteName = sanitizeQuoteName(candidate.quoteName);
  const items = parseCartLineItemsPayload(candidate.items);

  if (!quoteName || !items) {
    return null;
  }

  return { quoteName, items };
}
