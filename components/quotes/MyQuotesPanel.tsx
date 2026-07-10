"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CustomerAccountNav } from "@/components/account/CustomerAccountNav";
import { QuoteSummaryCard } from "@/components/quotes/QuoteSummaryCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ClipboardListIcon, ShoppingCartIcon } from "@/components/ui/Icon";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";
import { useCartStore } from "@/store/useCartStore";
import type { QuoteDetailResponse, QuoteSummary } from "@/types/quotes";

export function MyQuotesPanel() {
  const router = useRouter();
  const setItems = useCartStore((state) => state.setItems);
  const setQuotePriceChangeNotice = useCartStore((state) => state.setQuotePriceChangeNotice);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingQuoteId, setLoadingQuoteId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/quotes");

      if (response.status === 401) {
        router.replace("/login?redirect=/account/quotes");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load quotes");
      }

      const data = (await response.json()) as { quotes: QuoteSummary[] };
      setQuotes(data.quotes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quotes");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

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

  return (
    <div className={ui.catalogPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainerNarrow} py-4`}>
          <div>
            <p className={ui.eyebrow}>Account</p>
            <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
              <ClipboardListIcon size={26} className="text-brand" />
              My Quotes
            </h1>
            <p className={`mt-1 ${ui.bodyMuted}`}>
              Saved project drafts from your cart. Load any quote back into your cart to continue.
            </p>
          </div>
          <div className="mt-5">
            <CustomerAccountNav active="quotes" />
          </div>
        </div>
      </header>

      <main className={`${ui.pageContainerNarrow} py-8 ${ui.sectionStack}`}>
        {isLoading ? (
          <LoadingState label="Loading your quotes..." minHeight="min-h-[240px]" spinnerSize="lg" />
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button type="button" onClick={() => void loadQuotes()} className={`mt-4 ${ui.btnPrimary}`}>
              Retry
            </button>
          </div>
        ) : quotes.length === 0 ? (
          <div className={`px-6 py-12 text-center ${ui.emptyState}`}>
            <ClipboardListIcon size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-base font-semibold text-slate-900 dark:text-cream">
              No saved quotes yet
            </p>
            <p className={`mt-2 ${ui.bodyMuted}`}>
              Add cabinets to your cart and use Save as Quote to store a project draft.
            </p>
            <Link href="/cart" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
              <ShoppingCartIcon size={15} />
              Go to cart
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
                onLoadToCart={() => void loadQuoteIntoCart(quote.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
