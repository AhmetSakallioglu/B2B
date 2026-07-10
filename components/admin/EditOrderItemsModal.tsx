"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { OrderItem } from "@/types/orders";

type EditableLine = {
  key: string;
  itemId?: number;
  variantSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  isNew?: boolean;
};

type EditOrderItemsModalProps = {
  open: boolean;
  orderId: number;
  items: OrderItem[];
  currentTotal: number;
  loading?: boolean;
  onConfirm: (payload: {
    items: Array<{ itemId?: number; variantSku?: string; quantity: number }>;
  }) => void;
  onCancel: () => void;
};

function buildEditableLines(items: OrderItem[]): EditableLine[] {
  return items.map((item) => ({
    key: `item-${item.id}`,
    itemId: item.id,
    variantSku: item.variantSku,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
}

export function EditOrderItemsModal({
  open,
  orderId,
  items,
  currentTotal,
  loading = false,
  onConfirm,
  onCancel,
}: EditOrderItemsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [newSku, setNewSku] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  useDeferredEffect(() => {
    if (open) {
      setLines(buildEditableLines(items));
      setNewSku("");
      setNewQty(1);
      setValidationError(null);
    }
  }, [open, items]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [loading, onCancel, open]);

  const projectedSubtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [lines]
  );

  if (!open) {
    return null;
  }

  const updateQuantity = (key: string, quantity: number) => {
    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? { ...line, quantity: Math.max(0, Math.min(9999, quantity)) }
          : line
      )
    );
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const addLine = () => {
    const sku = newSku.trim().toUpperCase();

    if (!sku) {
      setValidationError("Enter a cabinet SKU to add.");
      return;
    }

    if (!Number.isInteger(newQty) || newQty <= 0) {
      setValidationError("Quantity must be a positive whole number.");
      return;
    }

    setLines((current) => [
      ...current,
      {
        key: `new-${sku}-${Date.now()}`,
        variantSku: sku,
        productName: "New cabinet (SKU lookup on save)",
        quantity: newQty,
        unitPrice: 0,
        isNew: true,
      },
    ]);
    setNewSku("");
    setNewQty(1);
    setValidationError(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const activeLines = lines.filter((line) => line.quantity > 0);

    if (activeLines.length === 0) {
      setValidationError("Order must include at least one line item.");
      return;
    }

    const payload = {
      items: activeLines.map((line) =>
        line.isNew
          ? { variantSku: line.variantSku, quantity: line.quantity }
          : { itemId: line.itemId, quantity: line.quantity }
      ),
    };

    onConfirm(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 shadow-xl ${ui.adminCard}`}
      >
        <h2 id={titleId} className={ui.heading2}>
          Edit Order Items
        </h2>
        <p id={descriptionId} className={`mt-2 ${ui.bodyMuted}`}>
          Order #{orderId} · Current total {formatPrice(currentTotal)}. Adjust quantities, remove
          lines, or add cabinet SKUs. Financial adjustments (refund or additional payment) are
          calculated automatically on save.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-zinc-700/50">
            <table className="min-w-full text-left text-sm">
              <thead className={ui.tableHead}>
                <tr>
                  <th className={ui.tableHeadCell}>SKU</th>
                  <th className={ui.tableHeadCell}>Product</th>
                  <th className={ui.tableHeadCell}>Qty</th>
                  <th className={ui.tableHeadCell}>Unit</th>
                  <th className={ui.tableHeadCell} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className={ui.tableRow}>
                    <td className={ui.tableCell}>
                      <span className="font-medium text-slate-900 dark:text-cream">
                        {line.variantSku}
                      </span>
                      {line.isNew && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                          New
                        </span>
                      )}
                    </td>
                    <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                      {line.productName}
                    </td>
                    <td className={ui.tableCell}>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={line.quantity}
                        disabled={loading}
                        onChange={(event) =>
                          updateQuantity(line.key, Number.parseInt(event.target.value, 10) || 0)
                        }
                        className={`${ui.input} w-24`}
                        aria-label={`Quantity for ${line.variantSku}`}
                      />
                    </td>
                    <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                      {line.isNew ? "Priced on save" : formatPrice(line.unitPrice)}
                    </td>
                    <td className={ui.tableCell}>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => removeLine(line.key)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 dark:border-zinc-600 dark:bg-navy-hover/40">
            <p className="text-sm font-semibold text-slate-900 dark:text-cream">Add cabinet code</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-cream/60">
                Variant SKU
                <input
                  type="text"
                  value={newSku}
                  disabled={loading}
                  onChange={(event) => setNewSku(event.target.value.toUpperCase())}
                  className={ui.input}
                  placeholder="e.g. BC-36-WHITE"
                  maxLength={64}
                />
              </label>
              <label className="flex w-28 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-cream/60">
                Qty
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={newQty}
                  disabled={loading}
                  onChange={(event) =>
                    setNewQty(Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                  }
                  className={ui.input}
                />
              </label>
              <button type="button" disabled={loading} onClick={addLine} className={ui.btnSecondary}>
                Add line
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-zinc-700/50 dark:bg-navy">
            <p className="text-sm text-slate-600 dark:text-cream/75">
              Projected merchandise subtotal (excl. tax/shipping):{" "}
              <span className="font-semibold text-slate-900 dark:text-cream">
                {formatPrice(projectedSubtotal)}
              </span>
            </p>
          </div>

          {validationError && (
            <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={loading} onClick={onCancel} className={ui.btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={ui.btnPrimary}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Saving...
                </span>
              ) : (
                "Save modifications"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
