"use client";

import type { AdminDoorFinish } from "@/types/door-finish";
import { ui } from "@/lib/ui-classes";

type FinishMultiSelectProps = {
  finishes: AdminDoorFinish[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  activeFinishId?: number;
  /** single = click replaces selection; multiple = click toggles finishes on/off */
  mode?: "single" | "multiple";
};

export function FinishMultiSelect({
  finishes,
  selectedIds,
  onChange,
  disabled = false,
  activeFinishId,
  mode = "multiple",
}: FinishMultiSelectProps) {
  const toggleFinish = (finishId: number) => {
    if (disabled) {
      return;
    }

    if (mode === "single") {
      onChange([finishId]);
      return;
    }

    if (selectedIds.includes(finishId)) {
      if (selectedIds.length === 1) {
        return;
      }

      onChange(selectedIds.filter((id) => id !== finishId));
      return;
    }

    onChange([...selectedIds, finishId].sort((a, b) => a - b));
  };

  if (finishes.length === 0) {
    return (
      <p className={ui.bodyMuted}>
        No door finishes available. Add finishes first.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {finishes.map((finish) => {
          const isSelected = selectedIds.includes(finish.id);
          const isActive = activeFinishId === finish.id;

          return (
            <button
              key={finish.id}
              type="button"
              disabled={disabled}
              onClick={() => toggleFinish(finish.id)}
              className={`${
                isSelected ? ui.catalogSubPillActive : ui.catalogSubPillIdle
              } ${isActive ? "ring-2 ring-brand ring-offset-2 ring-offset-white dark:ring-offset-navy" : ""} ${
                disabled ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              {finish.name}
              {isActive ? " · current" : ""}
            </button>
          );
        })}
      </div>
      <p className={`text-xs ${ui.bodyMuted}`}>
        {mode === "single"
          ? "One finish at a time. Variant SKU is editable for the selected finish."
          : `${selectedIds.length} finish${selectedIds.length === 1 ? "" : "es"} selected. Click to add or remove. At least one finish is required.`}
      </p>
    </div>
  );
}
