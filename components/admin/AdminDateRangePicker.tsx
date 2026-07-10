"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ADMIN_DATE_RANGE_PRESETS,
  buildAdminDateRangeFromPreset,
  detectDateRangePreset,
  formatAdminDateRangeLabel,
  getDefaultAdminDateRange,
  type AdminDateRangePreset,
} from "@/lib/admin-date-range";
import type { DashboardDateRange } from "@/lib/admin-dashboard-stats";
import { ui } from "@/lib/ui-classes";

type AdminDateRangePickerProps = {
  value: DashboardDateRange | null;
  onChange: (range: DashboardDateRange | null) => void;
  disabled?: boolean;
  placeholder?: string;
  allowClear?: boolean;
  label?: string;
  fullWidth?: boolean;
  menuAlign?: "left" | "right";
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const MENU_WIDTH = 352;

function resolveMenuPosition(
  anchor: DOMRect,
  menuAlign: "left" | "right"
): MenuPosition {
  const width = Math.min(window.innerWidth - 32, MENU_WIDTH);
  let left = menuAlign === "right" ? anchor.right - width : anchor.left;

  left = Math.max(16, Math.min(left, window.innerWidth - width - 16));

  return {
    top: anchor.bottom + 8,
    left,
    width,
  };
}

export function AdminDateRangePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "All dates",
  allowClear = false,
  label,
  fullWidth = false,
  menuAlign = "right",
}: AdminDateRangePickerProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const fallbackRange = value ?? getDefaultAdminDateRange();
  const [draftStart, setDraftStart] = useState(fallbackRange.startDate);
  const [draftEnd, setDraftEnd] = useState(fallbackRange.endDate);
  const activePreset = value ? detectDateRangePreset(value) : null;

  useEffect(() => {
    const next = value ?? getDefaultAdminDateRange();
    setDraftStart(next.startDate);
    setDraftEnd(next.endDate);
  }, [value]);

  useEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!buttonRef.current) {
        return;
      }

      setMenuPosition(resolveMenuPosition(buttonRef.current.getBoundingClientRect(), menuAlign));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuAlign, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const applyPreset = (preset: AdminDateRangePreset) => {
    if (preset === "custom") {
      return;
    }

    onChange(buildAdminDateRangeFromPreset(preset));
    setOpen(false);
  };

  const applyCustomRange = () => {
    if (!draftStart || !draftEnd) {
      return;
    }

    onChange({
      startDate: draftStart,
      endDate: draftEnd >= draftStart ? draftEnd : draftStart,
    });
    setOpen(false);
  };

  const buttonLabel = value
    ? ADMIN_DATE_RANGE_PRESETS.find((entry) => entry.id === activePreset)?.label ??
      formatAdminDateRangeLabel(value)
    : placeholder;

  const menu =
    open && menuPosition ? (
      <div
        ref={menuRef}
        id={menuId}
        role="dialog"
        aria-label="Select date range"
        style={{
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          zIndex: 1000,
        }}
        className={`space-y-4 p-4 shadow-xl ${ui.adminCard}`}
      >
        {allowClear && value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full ${ui.btnSecondary}`}
          >
            Clear date filter
          </button>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-cream/60">
            Quick ranges
          </p>
          <div className="flex flex-wrap gap-2">
            {ADMIN_DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={
                  activePreset === preset.id ? ui.catalogSubPillActive : ui.catalogSubPillIdle
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-200/80 pt-4 dark:border-zinc-700/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-cream/60">
            Custom range
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-cream/60">
              Start
              <input
                type="date"
                value={draftStart}
                onChange={(event) => setDraftStart(event.target.value)}
                className={ui.input}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-cream/60">
              End
              <input
                type="date"
                value={draftEnd}
                onChange={(event) => setDraftEnd(event.target.value)}
                className={ui.input}
              />
            </label>
          </div>
          <button type="button" onClick={applyCustomRange} className={`w-full ${ui.btnPrimary}`}>
            Apply custom range
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? "w-full" : "inline-block"}`}
    >
      {label ? (
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-cream/60">{label}</p>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className={`${ui.btnSecondary} ${fullWidth ? "w-full" : "min-w-[11rem]"} justify-between gap-3 disabled:opacity-60`}
      >
        <span className="truncate text-left">{buttonLabel}</span>
        <span className="text-xs text-slate-400 dark:text-cream/50" aria-hidden>
          ▾
        </span>
      </button>

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
