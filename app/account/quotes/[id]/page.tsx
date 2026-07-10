"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CustomerAccountNav } from "@/components/account/CustomerAccountNav";
import { QuotePriceChangeBanner } from "@/components/quotes/QuotePriceChangeBanner";
import { LoadingState } from "@/components/ui/LoadingState";
import { ArrowLeftIcon, ClipboardListIcon, ShoppingCartIcon } from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { getCartItemDimensionsLabel, stripCartItemDimensions } from "@/lib/format-dimensions";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import { useCartStore } from "@/store/useCartStore";
import type { QuoteDetailResponse } from "@/types/quotes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AccountQuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quoteId = Number.parseInt(params.id, 10);
  const setItems = useCartStore((state) => state.setItems);
  const setQuotePriceChangeNotice = useCartStore((state) => state.setQuotePriceChangeNotice);

  const [quoteData, setQuoteData] = useState<QuoteDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCart, setIsLoadingCart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuote = useCallback(async () => {
    if (Number.isNaN(quoteId)) {
      setError("Invalid quote id");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quotes/${quoteId}`);

      if (response.status === 401) {
        router.replace(`/login?redirect=/account/quotes/${quoteId}`);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load quote");
      }

      const data = (await response.json()) as QuoteDetailResponse;
      setQuoteData(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quote");
    } finally {
      setIsLoading(false);
    }
  }, [quoteId, router]);

  useDeferredEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const loadIntoCart = async () => {
    if (!quoteData) {
      return;
    }

    setIsLoadingCart(true);
    setError(null);

    try {
      setItems(quoteData.quote.items);

      if (quoteData.price_changed && quoteData.changed_items) {
        setQuotePriceChangeNotice({
          oldTotalAmount: quoteData.old_total_amount ?? quoteData.quote.totalAmount,
          newTotalAmount: quoteData.new_total_amount ?? quoteData.quote.totalAmount,
          changedItems: quoteData.changed_items,
        });
      } else {
        setQuotePriceChangeNotice(null);
      }

      await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: quoteData.quote.items }),
      });

      router.push("/cart");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quote into cart");
    } finally {
      setIsLoadingCart(false);
    }
  };

  const quote = quoteData?.quote;
  const changedByVariantId = new Map(
    (quoteData?.changed_items ?? []).map((item) => [item.variantId, item])
  );

  return (
    <div className={ui.catalogPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainerNarrow} py-4`}>
          <Link href="/account/quotes" className={ui.btnSecondary}>
            <IconLabel icon={<ArrowLeftIcon size={15} />}>Back to My Quotes</IconLabel>
          </Link>
          <div className="mt-4">
            <p className={ui.eyebrow}>Account</p>
            <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
              <ClipboardListIcon size={26} className="text-brand" />
              {quote?.quoteName ?? "Quote details"}
            </h1>
          </div>
          <div className="mt-5">
            <CustomerAccountNav active="quotes" />
          </div>
        </div>
      </header>

      <main className={`${ui.pageContainerNarrow} space-y-6 py-8`}>
        {isLoading ? (
          <LoadingState label="Loading quote..." minHeight="min-h-[320px]" spinnerSize="lg" />
        ) : error || !quote ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-red-700 dark:text-red-300">{error ?? "Quote not found"}</p>
          </div>
        ) : (
          <>
            {quoteData.price_changed && (
              <QuotePriceChangeBanner
                oldTotalAmount={quoteData.old_total_amount}
                newTotalAmount={quoteData.new_total_amount}
                changedItems={quoteData.changed_items}
              />
            )}

            <div className={`flex flex-wrap items-start justify-between gap-4 p-5 ${ui.catalogCard}`}>
              <div>
                <p className={ui.bodyMuted}>
                  {quote.items.reduce((count, item) => count + item.quantity, 0)} items · Updated{" "}
                  {formatDate(quote.updatedAt)}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-cream/60">
                  Status: {quote.status.replace("_", " ")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold tracking-tight text-brand">
                  {formatPrice(quote.totalAmount)}
                </p>
                {quoteData.price_changed && quoteData.old_total_amount !== undefined && (
                  <p className={`mt-1 text-sm line-through ${ui.bodyMuted}`}>
                    Was {formatPrice(quoteData.old_total_amount)}
                  </p>
                )}
                <button
                  type="button"
                  disabled={isLoadingCart}
                  onClick={() => void loadIntoCart()}
                  className={`mt-3 inline-flex ${ui.btnSecondary} border-brand/30 text-brand enabled:hover:bg-brand-light/30`}
                >
                  <ShoppingCartIcon size={15} />
                  {isLoadingCart ? "Loading..." : "Load into cart"}
                </button>
              </div>
            </div>

            <section className={`p-5 ${ui.catalogCard}`}>
              <h2 className={ui.heading3}>Line items</h2>
              <div className="mt-4 space-y-3">
                {quote.items.map((item) => {
                  const dimensionsLabel = getCartItemDimensionsLabel(item);
                  const priceChange = changedByVariantId.get(item.id);

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-zinc-700/50 dark:bg-navy-hover/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-cream">
                            {stripCartItemDimensions(item.name)}
                          </p>
                          {dimensionsLabel && (
                            <p className={`mt-1 text-xs ${ui.bodyMuted}`}>{dimensionsLabel}</p>
                          )}
                          {priceChange && !priceChange.outOfStock && priceChange.newPrice !== null && (
                            <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                              Was {formatPrice(priceChange.oldPrice)} — Now{" "}
                              {formatPrice(priceChange.newPrice)}
                            </p>
                          )}
                          {priceChange?.outOfStock && (
                            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                              No longer available
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-bold text-brand">
                            {formatPrice(item.price * item.quantity)}
                          </p>
                          <p className={`text-xs ${ui.bodyMuted}`}>
                            Qty {item.quantity} · {formatPrice(item.price)} each
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
