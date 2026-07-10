import path from "path";
import type { ClientQuoteLineItem } from "@/types/client-quotes";

export type ClientQuoteStoredItem = {
  variant_id: number;
  cabinet_code: string;
  quantity: number;
  unit_price: number;
};

const PDF_STORAGE_PREFIX = "/storage/client-quotes/";

export function isClientQuotePdfUrl(storedUrl: string | null | undefined) {
  if (!storedUrl) {
    return false;
  }

  return (
    storedUrl.startsWith(PDF_STORAGE_PREFIX) ||
    storedUrl.includes("/client-quotes/")
  );
}

export function serializeClientQuoteItems(
  items: ClientQuoteLineItem[]
): ClientQuoteStoredItem[] {
  return items.map((item) => ({
    variant_id: Number.parseInt(item.variantId, 10),
    cabinet_code: item.productSku,
    quantity: item.quantity,
    unit_price: item.clientUnitPrice,
  }));
}

export function parseClientQuoteStoredItems(value: unknown): ClientQuoteStoredItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;

      const variantId = Number.parseInt(
        String(row.variant_id ?? row.variantId ?? ""),
        10
      );
      const cabinetCode = String(row.cabinet_code ?? row.productSku ?? "").trim();
      const quantity = Number(row.quantity);
      const unitPrice = Number(row.unit_price ?? row.clientUnitPrice ?? 0);

      if (!Number.isInteger(variantId) || variantId <= 0) {
        return null;
      }

      if (!cabinetCode) {
        return null;
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return null;
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return null;
      }

      return {
        variant_id: variantId,
        cabinet_code: cabinetCode,
        quantity,
        unit_price: unitPrice,
      } satisfies ClientQuoteStoredItem;
    })
    .filter((item): item is ClientQuoteStoredItem => item !== null);
}

export function resolveClientQuotePdfPath(storedUrl: string | null | undefined) {
  if (!isClientQuotePdfUrl(storedUrl)) {
    return null;
  }

  if (!storedUrl!.startsWith("/")) {
    return null;
  }

  const normalized = storedUrl!.replace(/\\/g, "/");

  if (!normalized.startsWith(PDF_STORAGE_PREFIX)) {
    return null;
  }

  const filename = path.basename(normalized);

  if (!filename || filename.includes("..")) {
    return null;
  }

  return path.join(process.cwd(), "storage", "client-quotes", filename);
}
