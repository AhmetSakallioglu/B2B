import type { OrderCartItem } from "@/types/catalog";
import type { CheckoutLineItem } from "@/types/checkout";
import { sanitizePlainText } from "@/lib/input-sanitization";

const MAX_CART_ITEMS = 200;
const MAX_VARIANT_ID_LENGTH = 64;
const MAX_ITEM_NAME_LENGTH = 500;
const MAX_DIMENSION_LENGTH = 32;

export type CartLineInput = CheckoutLineItem;

function readVariantId(candidate: Record<string, unknown>): string | null {
  const raw = candidate.variantId ?? candidate.variant_id ?? candidate.id;

  if (typeof raw !== "string") {
    return null;
  }

  const cleaned = raw.trim();

  if (!cleaned || cleaned.length > MAX_VARIANT_ID_LENGTH) {
    return null;
  }

  return cleaned;
}

export function parseCartLineItemsPayload(value: unknown): CartLineInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CART_ITEMS) {
    return null;
  }

  const parsed: CartLineInput[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const candidate = entry as Record<string, unknown>;
    const variantId = readVariantId(candidate);

    if (
      !variantId ||
      typeof candidate.quantity !== "number" ||
      !Number.isInteger(candidate.quantity) ||
      candidate.quantity <= 0 ||
      candidate.quantity > 9999
    ) {
      return null;
    }

    parsed.push({ variantId, quantity: candidate.quantity });
  }

  return parsed;
}

function isOptionalDimension(value: unknown) {
  return value === undefined || (typeof value === "string" && value.length <= MAX_DIMENSION_LENGTH);
}

export function isValidCartItem(item: unknown): item is OrderCartItem {
  if (!item || typeof item !== "object") {
    return false;
  }

  const candidate = item as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    candidate.id.length <= 64 &&
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    candidate.name.length <= MAX_ITEM_NAME_LENGTH &&
    typeof candidate.price === "number" &&
    Number.isFinite(candidate.price) &&
    candidate.price >= 0 &&
    typeof candidate.quantity === "number" &&
    Number.isInteger(candidate.quantity) &&
    candidate.quantity > 0 &&
    candidate.quantity <= 9999 &&
    isOptionalDimension(candidate.width) &&
    isOptionalDimension(candidate.height) &&
    isOptionalDimension(candidate.depth)
  );
}

export function parseCartItemsPayload(value: unknown): OrderCartItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CART_ITEMS) {
    return null;
  }

  if (!value.every(isValidCartItem)) {
    return null;
  }

  const parsed: OrderCartItem[] = [];

  for (const item of value) {
    const name = sanitizePlainText(item.name, MAX_ITEM_NAME_LENGTH, true);

    if (!name) {
      return null;
    }

    parsed.push({
      id: item.id.trim(),
      name,
      price: item.price,
      quantity: item.quantity,
      ...(item.width !== undefined ? { width: item.width.trim() } : {}),
      ...(item.height !== undefined ? { height: item.height.trim() } : {}),
      ...(item.depth !== undefined ? { depth: item.depth.trim() } : {}),
    });
  }

  return parsed;
}

export function calculateCartTotal(items: OrderCartItem[]) {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function roundQuoteTotal(value: number) {
  return Math.round(value * 100) / 100;
}
