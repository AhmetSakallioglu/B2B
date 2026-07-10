import {
  detectSuspiciousAdminSearchInput,
  invalidAdminSearchResponse,
  sanitizeAdminSearchString,
} from "@/lib/admin-search-sanitization";
import { sanitizeInboundString } from "@/lib/input-sanitization";
import { ADMIN_SEARCH_PARAM_LIMITS } from "@/types/admin-search-sanitization";
import type { OrderModificationLineInput } from "@/types/order-modification";

const MAX_MODIFICATION_LINES = 100;
const MAX_QUANTITY = 9999;

export function parseOrderModificationPayload(body: unknown): OrderModificationLineInput[] | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const items = (body as Record<string, unknown>).items;

  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_MODIFICATION_LINES) {
    return null;
  }

  const parsed: OrderModificationLineInput[] = [];

  for (const entry of items) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const candidate = entry as Record<string, unknown>;
    const quantityRaw = candidate.quantity;

    if (
      typeof quantityRaw !== "number" ||
      !Number.isInteger(quantityRaw) ||
      quantityRaw < 0 ||
      quantityRaw > MAX_QUANTITY
    ) {
      return null;
    }

    let itemId: number | undefined;
    let variantSku: string | undefined;

    if (candidate.itemId !== undefined && candidate.itemId !== null) {
      if (
        typeof candidate.itemId !== "number" ||
        !Number.isInteger(candidate.itemId) ||
        candidate.itemId <= 0
      ) {
        return null;
      }

      itemId = candidate.itemId;
    }

    if (candidate.variantSku !== undefined && candidate.variantSku !== null) {
      if (typeof candidate.variantSku !== "string") {
        return null;
      }

      const suspicious = detectSuspiciousAdminSearchInput("variantSku", candidate.variantSku);

      if (suspicious) {
        return null;
      }

      variantSku = sanitizeAdminSearchString(
        candidate.variantSku,
        ADMIN_SEARCH_PARAM_LIMITS.variantSku
      ).toUpperCase();

      if (!variantSku) {
        return null;
      }
    }

    if (!itemId && !variantSku) {
      return null;
    }

    if (itemId && variantSku) {
      return null;
    }

    parsed.push({
      itemId,
      variantSku,
      quantity: quantityRaw,
    });
  }

  const positiveLines = parsed.filter((line) => line.quantity > 0);

  if (positiveLines.length === 0) {
    return null;
  }

  return positiveLines;
}

export function sanitizeModificationNotes(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return sanitizeInboundString(value, 500);
}

export function modificationValidationResponse() {
  return invalidAdminSearchResponse();
}
