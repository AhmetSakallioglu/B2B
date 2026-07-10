"use client";

import { MinusIcon, PlusIcon } from "@/components/ui/Icon";

type QuantitySelectorProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  size = "md",
  className = "",
}: QuantitySelectorProps) {
  const buttonSize = size === "md" ? "h-11 w-11" : "h-8 w-8";
  const textSize = size === "md" ? "min-w-10 text-base" : "min-w-8 text-sm";

  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-600 dark:bg-navy-hover ${className}`}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={decrement}
        className={`flex ${buttonSize} items-center justify-center rounded-lg text-slate-700 transition enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:text-cream dark:enabled:hover:bg-navy`}
        aria-label="Decrease quantity"
      >
        <MinusIcon size={size === "md" ? 16 : 14} />
      </button>
      <span
        className={`${textSize} select-none text-center font-semibold tabular-nums text-slate-900 dark:text-cream`}
        aria-live="polite"
        aria-label={`Quantity ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={increment}
        className={`flex ${buttonSize} items-center justify-center rounded-lg text-slate-700 transition enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:text-cream dark:enabled:hover:bg-navy`}
        aria-label="Increase quantity"
      >
        <PlusIcon size={size === "md" ? 16 : 14} />
      </button>
    </div>
  );
}
