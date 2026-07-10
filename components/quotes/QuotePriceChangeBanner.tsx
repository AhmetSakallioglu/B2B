"use client";

import { formatPrice } from "@/lib/order-display";
import type { QuotePriceChangedItem } from "@/types/quotes";

type QuotePriceChangeBannerProps = {
  oldTotalAmount?: number;
  newTotalAmount?: number;
  changedItems?: QuotePriceChangedItem[];
  onDismiss?: () => void;
  className?: string;
};

export function QuotePriceChangeBanner({
  oldTotalAmount,
  newTotalAmount,
  changedItems = [],
  onDismiss,
  className = "",
}: QuotePriceChangeBannerProps) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-amber-300/80 bg-linear-to-r from-amber-50 via-orange-50 to-amber-50 px-5 py-4 shadow-sm dark:border-amber-700/50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            ⚠️ Notice: The pricing or stock status for some items in this project has changed since
            it was saved. Your cart has been automatically updated with current contract pricing.
          </p>

          {oldTotalAmount !== undefined && newTotalAmount !== undefined && (
            <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/80">
              Project total:{" "}
              <span className="line-through opacity-70">{formatPrice(oldTotalAmount)}</span>
              {" → "}
              <span className="font-semibold">{formatPrice(newTotalAmount)}</span>
            </p>
          )}

          {changedItems.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {changedItems.map((item) => (
                <li
                  key={item.variantId}
                  className="flex items-center gap-2 text-xs text-amber-900/90 dark:text-amber-100/80"
                >
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-[10px] font-bold text-amber-900 dark:bg-amber-800/60 dark:text-amber-100"
                    title="Price or stock changed"
                    aria-hidden
                  >
                    i
                  </span>
                  {item.outOfStock ? (
                    <span>
                      Variant #{item.variantId}: no longer available
                      {item.oldPrice > 0 && (
                        <>
                          {" "}
                          (was {formatPrice(item.oldPrice)})
                        </>
                      )}
                    </span>
                  ) : item.newPrice !== null ? (
                    <span>
                      Was {formatPrice(item.oldPrice)} — Now {formatPrice(item.newPrice)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-amber-900/80 transition hover:bg-amber-200/60 dark:text-amber-100/80 dark:hover:bg-amber-800/40"
            aria-label="Dismiss notice"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export function QuoteItemPriceChangeHint({
  oldPrice,
  newPrice,
  outOfStock,
}: {
  oldPrice: number;
  newPrice: number | null;
  outOfStock?: boolean;
}) {
  if (outOfStock) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-[10px] font-bold text-amber-900 dark:bg-amber-800/60 dark:text-amber-100"
          aria-hidden
        >
          i
        </span>
        Was {formatPrice(oldPrice)} — no longer available
      </p>
    );
  }

  if (newPrice === null || newPrice === oldPrice) {
    return null;
  }

  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-[10px] font-bold text-amber-900 dark:bg-amber-800/60 dark:text-amber-100"
        aria-hidden
      >
        i
      </span>
      Was {formatPrice(oldPrice)} — Now {formatPrice(newPrice)}
    </p>
  );
}
