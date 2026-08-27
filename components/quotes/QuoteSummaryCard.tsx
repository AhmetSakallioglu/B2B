"use client";

import Link from "next/link";
import { ClipboardListIcon, PackageIcon, ShoppingCartIcon } from "@/components/ui/Icon";
import { formatPrice } from "@/lib/order-display";
import { isArchivedQuoteStatus, type QuoteStatus } from "@/lib/quote-validation";
import { ui } from "@/lib/ui-classes";
import type { QuoteSummary } from "@/types/quotes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function quoteStatusLabel(status: QuoteStatus) {
  if (status === "archived") {
    return "Archived";
  }

  return status === "pending_approval" ? "Pending approval" : "Draft";
}

function quoteStatusBadgeClass(status: QuoteStatus) {
  if (status === "archived") {
    return "border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-600 dark:bg-navy-hover dark:text-cream/70";
  }

  if (status === "pending_approval") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-600 dark:bg-navy-hover dark:text-cream/85";
}

type QuoteSummaryCardProps = {
  quote: QuoteSummary;
  isLoading: boolean;
  isUpdating?: boolean;
  onLoadToCart: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
};

export function QuoteSummaryCard({
  quote,
  isLoading,
  isUpdating = false,
  onLoadToCart,
  onArchive,
  onRestore,
}: QuoteSummaryCardProps) {
  const createdLabel = formatDate(quote.createdAt);
  const updatedLabel = formatDate(quote.updatedAt);
  const showUpdated = quote.updatedAt !== quote.createdAt;
  const archived = isArchivedQuoteStatus(quote.status);

  return (
    <article
      className={`overflow-hidden border-l-4 border-l-brand ${ui.adminCardInteractive}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 flex-1 gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/20 bg-brand-light/40 text-brand dark:border-brand/30 dark:bg-brand-light/15">
            <ClipboardListIcon size={20} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-cream">
                {quote.quoteName}
              </h2>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${quoteStatusBadgeClass(quote.status)}`}
              >
                {quoteStatusLabel(quote.status)}
              </span>
            </div>

            <p className={`mt-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-cream/55`}>
              Quote #{quote.id}
            </p>

            <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs ${ui.bodyMuted}`}>
              <span className="inline-flex items-center gap-1.5">
                <PackageIcon size={13} className="shrink-0 text-slate-400" />
                {quote.itemCount} item{quote.itemCount === 1 ? "" : "s"}
              </span>
              <span>Saved {createdLabel}</span>
              {showUpdated && <span>Updated {updatedLabel}</span>}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-cream/60">
            Quote total
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-brand">
            {formatPrice(quote.totalAmount)}
          </p>
        </div>
      </div>

      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6 ${ui.adminActionBar}`}
      >
        <p className={`text-xs ${ui.bodyMuted}`}>
          {archived
            ? "This quote is archived. Restore it to keep it in your active list, or load it into your cart."
            : "Reload this draft into your cart to edit quantities or place an order."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/account/quotes/${quote.id}`} className={ui.btnSecondary}>
            View details
          </Link>
          {archived ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={onRestore}
              className={ui.btnSecondary}
            >
              {isUpdating ? "Restoring..." : "Restore"}
            </button>
          ) : (
            <button
              type="button"
              disabled={isUpdating}
              onClick={onArchive}
              className={ui.btnGhost}
            >
              {isUpdating ? "Archiving..." : "Archive"}
            </button>
          )}
          <button
            type="button"
            disabled={isLoading}
            onClick={onLoadToCart}
            className={ui.btnPrimary}
          >
            <ShoppingCartIcon size={15} />
            {isLoading ? "Loading..." : "Load to cart"}
          </button>
        </div>
      </div>
    </article>
  );
}
