"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CustomerAccountNav } from "@/components/account/CustomerAccountNav";
import { QuotesFolderNav } from "@/components/quotes/QuotesFolderNav";
import { QuoteSummaryCard } from "@/components/quotes/QuoteSummaryCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ArchiveIcon, ClipboardListIcon, ShoppingCartIcon } from "@/components/ui/Icon";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";
import { useCartStore } from "@/store/useCartStore";
import type { QuoteDetail, QuoteDetailResponse, QuoteSummary } from "@/types/quotes";

type MyQuotesPanelProps = {
  archived?: boolean;
};

export function MyQuotesPanel({ archived = false }: MyQuotesPanelProps) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const setItems = useCartStore((state) => state.setItems);
  const setSourceQuoteId = useCartStore((state) => state.setSourceQuoteId);
  const setQuotePriceChangeNotice = useCartStore((state) => state.setQuotePriceChangeNotice);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingQuoteId, setLoadingQuoteId] = useState<number | null>(null);
  const [updatingQuoteId, setUpdatingQuoteId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quotes${archived ? "?archived=1" : ""}`);

      if (response.status === 401) {
        router.replace(`/login?redirect=${archived ? "/account/quotes/archive" : "/account/quotes"}`);
        return;
      }

      if (!response.ok) {
        throw new Error(archived ? "Failed to load archived quotes" : "Failed to load quotes");
      }

      const data = (await response.json()) as { quotes: QuoteSummary[] };
      setQuotes(data.quotes);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : archived
            ? "Failed to load archived quotes"
            : "Failed to load quotes"
      );
    } finally {
      setIsLoading(false);
    }
  }, [archived, router]);

  useDeferredEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  const loadQuoteIntoCart = async (quoteId: number) => {
    setLoadingQuoteId(quoteId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/quotes/${quoteId}`);

      if (!response.ok) {
        throw new Error("Failed to load quote");
      }

      const data = (await response.json()) as QuoteDetailResponse;

      setItems(data.quote.items);
      setSourceQuoteId(quoteId);

      if (data.price_changed && data.changed_items) {
        setQuotePriceChangeNotice({
          oldTotalAmount: data.old_total_amount ?? data.quote.totalAmount,
          newTotalAmount: data.new_total_amount ?? data.quote.totalAmount,
          changedItems: data.changed_items,
        });
      } else {
        setQuotePriceChangeNotice(null);
      }

      await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: data.quote.items }),
      });

      setMessage(
        data.price_changed
          ? "Quote loaded with updated contract pricing."
          : "Quote loaded into your cart."
      );
      router.push("/cart");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quote");
    } finally {
      setLoadingQuoteId(null);
    }
  };

  const setQuoteArchived = async (quoteId: number, nextArchived: boolean) => {
    if (nextArchived) {
      const confirmed = await confirm({
        title: "Archive this quote?",
        description:
          "It will move to Quote Archive and drop out of admin pipeline statistics. You can restore it later.",
        confirmLabel: "Archive quote",
        tone: "warning",
      });

      if (!confirmed) {
        return;
      }
    }

    setUpdatingQuoteId(quoteId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: nextArchived }),
      });

      if (!response.ok) {
        throw new Error(nextArchived ? "Failed to archive quote" : "Failed to restore quote");
      }

      const data = (await response.json()) as { quote: QuoteDetail };
      setQuotes((current) => current.filter((quote) => quote.id !== data.quote.id));
      setMessage(
        nextArchived ? "Quote moved to archive." : "Quote restored to your active list."
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : nextArchived
            ? "Failed to archive quote"
            : "Failed to restore quote"
      );
    } finally {
      setUpdatingQuoteId(null);
    }
  };

  return (
    <div className={ui.catalogPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainerNarrow} py-4`}>
          <div>
            <p className={ui.eyebrow}>Account</p>
            <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
              {archived ? (
                <ArchiveIcon size={26} className="text-brand" />
              ) : (
                <ClipboardListIcon size={26} className="text-brand" />
              )}
              {archived ? "Quote Archive" : "My Quotes"}
            </h1>
            <p className={`mt-1 ${ui.bodyMuted}`}>
              {archived
                ? "Quotes you archived or converted into an order. Restore any quote to keep working on it."
                : "Saved project drafts from your cart. Archive quotes you no longer need, or load one back into your cart to continue."}
            </p>
          </div>
          <div className="mt-5">
            <CustomerAccountNav active="quotes" />
          </div>
        </div>
      </header>

      <main className={`${ui.pageContainerNarrow} py-8 ${ui.sectionStack}`}>
        <QuotesFolderNav archived={archived} />

        {isLoading ? (
          <LoadingState
            label={archived ? "Loading archived quotes..." : "Loading your quotes..."}
            minHeight="min-h-[240px]"
            spinnerSize="lg"
          />
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button type="button" onClick={() => void loadQuotes()} className={`mt-4 ${ui.btnPrimary}`}>
              Retry
            </button>
          </div>
        ) : quotes.length === 0 ? (
          <div className={`px-6 py-12 text-center ${ui.emptyState}`}>
            {archived ? (
              <ArchiveIcon size={40} className="mx-auto text-slate-300" />
            ) : (
              <ClipboardListIcon size={40} className="mx-auto text-slate-300" />
            )}
            <p className="mt-4 text-base font-semibold text-slate-900 dark:text-cream">
              {archived ? "No archived quotes" : "No saved quotes yet"}
            </p>
            <p className={`mt-2 ${ui.bodyMuted}`}>
              {archived
                ? "When you archive a quote or place an order from one, it will appear here."
                : "Add cabinets to your cart and use Save as Quote to store a project draft."}
            </p>
            <Link
              href={archived ? "/account/quotes" : "/cart"}
              className={`mt-4 inline-flex ${ui.btnPrimary}`}
            >
              {archived ? (
                <>
                  <ClipboardListIcon size={15} />
                  Back to active quotes
                </>
              ) : (
                <>
                  <ShoppingCartIcon size={15} />
                  Go to cart
                </>
              )}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {message && <p className={`px-4 py-3 text-sm ${ui.cardMuted}`}>{message}</p>}
            {quotes.map((quote) => (
              <QuoteSummaryCard
                key={quote.id}
                quote={quote}
                isLoading={loadingQuoteId === quote.id}
                isUpdating={updatingQuoteId === quote.id}
                onLoadToCart={() => void loadQuoteIntoCart(quote.id)}
                onArchive={() => void setQuoteArchived(quote.id, true)}
                onRestore={() => void setQuoteArchived(quote.id, false)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
