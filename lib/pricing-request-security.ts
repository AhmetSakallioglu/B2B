const FORBIDDEN_TOP_LEVEL_PRICING_KEYS = [
  "totalAmount",
  "total",
  "totalPrice",
  "taxAmount",
  "taxRate",
  "shippingAmount",
  "shippingFee",
  "subtotal",
  "msrpSubtotal",
  "promoDiscount",
  "tierDiscountAmount",
  "taxableSubtotal",
  "amount",
  "price",
] as const;

const FORBIDDEN_LINE_ITEM_PRICING_KEYS = [
  "price",
  "unitPrice",
  "listPrice",
  "msrp",
  "total",
  "subtotal",
  "taxAmount",
  "shippingAmount",
] as const;

export function findClientPricingTamperField(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;

  for (const key of FORBIDDEN_TOP_LEVEL_PRICING_KEYS) {
    if (key in record) {
      return key;
    }
  }

  const items = record.items;

  if (!Array.isArray(items)) {
    return null;
  }

  for (const entry of items) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const line = entry as Record<string, unknown>;

    for (const key of FORBIDDEN_LINE_ITEM_PRICING_KEYS) {
      if (key in line) {
        return `items[].${key}`;
      }
    }
  }

  return null;
}

export function rejectClientPricingTampering(body: unknown) {
  const tamperedField = findClientPricingTamperField(body);

  if (!tamperedField) {
    return null;
  }

  return {
    error: `Client-supplied pricing field "${tamperedField}" is not allowed`,
    status: 400 as const,
  };
}
