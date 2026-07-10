import { parseCartLineItemsPayload } from "@/lib/cart-items";
import { sanitizePlainText } from "@/lib/input-sanitization";
import type { GenerateClientQuoteRequest } from "@/types/client-quotes";

export const CLIENT_NAME_MAX_LENGTH = 200;
export const CLIENT_EMAIL_MAX_LENGTH = 255;
export const CUSTOM_FOOTER_MAX_LENGTH = 1000;
export const MAX_MARKUP_PERCENTAGE = 100;

export const MARKUP_PRESETS = [0, 10, 20] as const;

export type ParseClientQuoteFormResult =
  | { ok: true; data: GenerateClientQuoteRequest }
  | { ok: false; error: string };

function parseBoolean(value: FormDataEntryValue | null | undefined, fallback = false) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseMarkupPercentage(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_MARKUP_PERCENTAGE) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

export function parseGenerateClientQuoteFormData(
  formData: FormData
): ParseClientQuoteFormResult {
  const clientNameRaw = formData.get("clientName");
  const clientName =
    typeof clientNameRaw === "string"
      ? sanitizePlainText(clientNameRaw, CLIENT_NAME_MAX_LENGTH)
      : null;

  if (!clientName || clientName.length < 2) {
    return { ok: false, error: "Enter a client or project name (at least 2 characters)." };
  }

  const clientEmailRaw = formData.get("clientEmail");
  const clientEmail =
    typeof clientEmailRaw === "string" && clientEmailRaw.trim()
      ? sanitizePlainText(clientEmailRaw, CLIENT_EMAIL_MAX_LENGTH)
      : null;

  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return { ok: false, error: "Enter a valid client email address." };
  }

  const markupPercentage = parseMarkupPercentage(formData.get("markupPercentage"));

  if (markupPercentage === null) {
    return { ok: false, error: "Enter a valid markup percentage between 0 and 100." };
  }

  const itemsRaw = formData.get("items");

  if (typeof itemsRaw !== "string") {
    return { ok: false, error: "Cart items are missing. Refresh the cart and try again." };
  }

  let parsedItems: unknown;

  try {
    parsedItems = JSON.parse(itemsRaw);
  } catch {
    return { ok: false, error: "Cart items could not be read. Refresh the cart and try again." };
  }

  const items = parseCartLineItemsPayload(parsedItems);

  if (!items) {
    return {
      ok: false,
      error: "Your cart is empty or contains invalid items. Refresh the cart and try again.",
    };
  }

  const includeShipping = parseBoolean(formData.get("includeShipping"));

  const shippingAddressIdRaw = formData.get("shippingAddressId");
  const shippingAddressId =
    typeof shippingAddressIdRaw === "string" && shippingAddressIdRaw.trim()
      ? shippingAddressIdRaw.trim()
      : null;

  if (includeShipping && !shippingAddressId) {
    return {
      ok: false,
      error: "Select a saved shipping address to include delivery on the quote.",
    };
  }

  const customFooterRaw = formData.get("customFooterText");
  const customFooterText =
    typeof customFooterRaw === "string" && customFooterRaw.trim()
      ? sanitizePlainText(customFooterRaw, CUSTOM_FOOTER_MAX_LENGTH)
      : null;

  return {
    ok: true,
    data: {
      clientName,
      clientEmail,
      markupPercentage,
      includeTax: parseBoolean(formData.get("includeTax")),
      includeShipping,
      shippingAddressId,
      customFooterText,
      items,
    },
  };
}

export function parseQuoteBrandingFooterBody(body: unknown): string | null | undefined {
  if (body === null) {
    return null;
  }

  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as Record<string, unknown>;

  if (!("customQuoteFooterText" in candidate)) {
    return undefined;
  }

  if (candidate.customQuoteFooterText === null) {
    return null;
  }

  if (typeof candidate.customQuoteFooterText !== "string") {
    return undefined;
  }

  const trimmed = candidate.customQuoteFooterText.trim();

  if (!trimmed) {
    return null;
  }

  return sanitizePlainText(trimmed, CUSTOM_FOOTER_MAX_LENGTH) ?? null;
}
