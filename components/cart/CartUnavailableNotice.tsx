"use client";

import { TrashIcon } from "@/components/ui/Icon";
import { CART_UNAVAILABLE_MESSAGE } from "@/lib/cart-validation.constants";
import { useCartStore } from "@/store/useCartStore";

type CartUnavailableNoticeProps = {
  compact?: boolean;
  onCleared?: () => void;
};

export function CartUnavailableNotice({
  compact = false,
  onCleared,
}: CartUnavailableNoticeProps) {
  const hasUnavailableItems = useCartStore((state) => state.hasUnavailableItems());
  const removeUnavailableItems = useCartStore((state) => state.removeUnavailableItems);

  if (!hasUnavailableItems) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 ${
        compact ? "px-3 py-2.5 text-xs" : "px-4 py-3 text-sm"
      }`}
    >
      <p>{CART_UNAVAILABLE_MESSAGE}</p>
      {!compact && (
        <p className="mt-1 text-xs opacity-90">
          Remove unavailable items or choose a different finish before placing your order.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          removeUnavailableItems();
          onCleared?.();
        }}
        className={`mt-3 inline-flex items-center gap-2 rounded-full border border-red-300 bg-white font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60 ${
          compact ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs"
        }`}
      >
        <TrashIcon size={compact ? 12 : 13} />
        Clear unavailable items
      </button>
    </div>
  );
}
