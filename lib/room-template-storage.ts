import type { RoomTemplateStoredItem } from "@/types/room-templates";

const MAX_TEMPLATE_LINES = 200;
const MAX_LINE_QUANTITY = 9999;

export function parseRoomTemplateStoredItems(value: unknown): RoomTemplateStoredItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TEMPLATE_LINES) {
    return [];
  }

  const parsed: RoomTemplateStoredItem[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const row = entry as Record<string, unknown>;
    const variantId = Number.parseInt(
      String(row.variant_id ?? row.variantId ?? row.id ?? ""),
      10
    );
    const cabinetCode = String(row.cabinet_code ?? row.cabinetCode ?? row.productSku ?? "")
      .trim()
      .slice(0, 64);
    const quantity = Number(row.quantity);

    if (!Number.isInteger(variantId) || variantId <= 0) {
      continue;
    }

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_LINE_QUANTITY) {
      continue;
    }

    parsed.push({
      variant_id: variantId,
      cabinet_code: cabinetCode || `variant-${variantId}`,
      quantity,
    });
  }

  return parsed;
}

export function summarizeRoomTemplateItems(items: RoomTemplateStoredItem[]) {
  return {
    lineCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}
