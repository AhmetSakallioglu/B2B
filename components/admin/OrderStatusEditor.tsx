"use client";

import { useState, type MouseEvent, type PointerEvent } from "react";
import { statusBadgeClass, statusLabel } from "@/lib/order-display";
import {
  ORDER_STATUS_OPTIONS,
  type OrderStatus,
} from "@/lib/order-status";
import { refreshAdminNotifications } from "@/components/admin/AdminNotificationsProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";

type OrderStatusEditorProps = {
  orderId: number;
  status: OrderStatus;
  onUpdated?: (status: OrderStatus) => void;
  compact?: boolean;
  stopPropagation?: boolean;
};

export function OrderStatusEditor({
  orderId,
  status,
  onUpdated,
  compact = false,
  stopPropagation = false,
}: OrderStatusEditorProps) {
  const [value, setValue] = useState(status);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDeferredEffect(() => {
    setValue(status);
  }, [status]);

  const handleChange = async (nextStatus: OrderStatus) => {
    if (nextStatus === status) {
      return;
    }

    setValue(nextStatus);
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update order status");
      }

      if (status === "pending" && nextStatus !== "pending") {
        refreshAdminNotifications();
      } else if (status !== "pending" && nextStatus === "pending") {
        refreshAdminNotifications();
      }

      onUpdated?.(nextStatus);
    } catch (updateError) {
      setValue(status);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update order status"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePointerEvent = (event: MouseEvent | PointerEvent) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
  };

  return (
    <div
      className={compact ? "inline-flex flex-col items-start gap-1" : "space-y-2"}
      onClick={handlePointerEvent}
      onPointerDown={handlePointerEvent}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!compact && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(value)}`}
          >
            {statusLabel(value)}
          </span>
        )}
        <select
          value={value}
          disabled={isSaving}
          onChange={(event) => handleChange(event.target.value as OrderStatus)}
          className={`${ui.select} disabled:opacity-60 ${
            compact ? "px-3 py-1.5 text-xs" : "text-sm"
          }`}
          aria-label={`Order #${orderId} status`}
        >
          {ORDER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isSaving && (
          <span className="text-xs text-muted dark:text-cream/70">Saving...</span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
