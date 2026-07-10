"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CustomerAccountNav } from "@/components/account/CustomerAccountNav";
import { LoadingState } from "@/components/ui/LoadingState";
import { MailIcon, ShoppingCartIcon } from "@/components/ui/Icon";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import { useCartStore } from "@/store/useCartStore";
import {
  CLIENT_QUOTE_STATUS_LABELS,
  type ClientQuoteStatus,
  type ClientQuoteSummary,
} from "@/types/client-quotes";
import type { OrderCartItem } from "@/types/catalog";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadgeClass(status: ClientQuoteStatus) {
  switch (status) {
    case "CONVERTED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
    case "EXPIRED":
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  }
}

export function MyClientQuotesPanel() {
  const router = useRouter();
  const setItems = useCartStore((state) => state.setItems);
  const [quotes, setQuotes] = useState<ClientQuoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionQuoteId, setActionQuoteId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/client-quotes");

      if (response.status === 401) {
        router.replace("/login?redirect=/account/client-quotes");
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to load client quotes");
      }

      const data = (await response.json()) as { quotes: ClientQuoteSummary[] };
      setQuotes(data.quotes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load client quotes");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useDeferredEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  const convertToCart = async (quoteId: number) => {
    setActionQuoteId(quoteId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/client-quotes/${quoteId}/convert-to-cart`, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        redirectTo?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to convert quote to cart");
      }

      const cartResponse = await fetch("/api/cart");

      if (cartResponse.ok) {
        const cartData = (await cartResponse.json()) as { items: OrderCartItem[] };
        setItems(cartData.items);
      }

      setMessage("Client quote loaded into your cart.");
      router.push(payload?.redirectTo ?? "/cart");
    } catch (convertError) {
      setError(
        convertError instanceof Error ? convertError.message : "Failed to convert quote to cart"
      );
    } finally {
      setActionQuoteId(null);
    }
  };

  return (
    <div className={ui.catalogPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainerNarrow} py-4`}>
          <div>
            <p className={ui.eyebrow}>Account</p>
            <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
              <MailIcon size={26} className="text-brand" />
              My Client Quotes
            </h1>
            <p className={`mt-1 ${ui.bodyMuted}`}>
              PDF quotes you generated for end customers. Download again or load items back into
              your cart to place an order.
            </p>
          </div>
          <div className="mt-5">
            <CustomerAccountNav active="client-quotes" />
          </div>
        </div>
      </header>

      <main className={`${ui.pageContainerNarrow} py-8 ${ui.sectionStack}`}>
        {isLoading ? (
          <LoadingState label="Loading client quotes..." minHeight="min-h-[240px]" spinnerSize="lg" />
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button type="button" onClick={() => void loadQuotes()} className={`mt-4 ${ui.btnPrimary}`}>
              Retry
            </button>
          </div>
        ) : quotes.length === 0 ? (
          <div className={`px-6 py-12 text-center ${ui.emptyState}`}>
            <MailIcon size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-base font-semibold text-slate-900 dark:text-cream">
              No client quotes yet
            </p>
            <p className={`mt-2 ${ui.bodyMuted}`}>
              Open your cart and use Generate Client Quote to create a branded PDF for a customer.
            </p>
            <Link href="/cart" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
              <ShoppingCartIcon size={15} />
              Go to cart
            </Link>
          </div>
        ) : (
          <div className={`overflow-x-auto ${ui.card}`}>
            {message && <p className={`border-b px-4 py-3 text-sm ${ui.cardMuted}`}>{message}</p>}
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200/80 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700/80">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(quote.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-cream">{quote.clientName}</p>
                      {quote.clientEmail && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{quote.clientEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatPrice(quote.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(quote.status)}`}
                      >
                        {CLIENT_QUOTE_STATUS_LABELS[quote.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {quote.pdfUrl ? (
                          <a
                            href={`/api/client-quotes/${quote.id}/pdf`}
                            className={ui.btnOutlineBrand}
                            download
                          >
                            Download PDF
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">PDF unavailable</span>
                        )}
                        <button
                          type="button"
                          className={ui.btnPrimary}
                          disabled={actionQuoteId === quote.id}
                          onClick={() => void convertToCart(quote.id)}
                        >
                          {actionQuoteId === quote.id ? "Loading..." : "Convert to Cart"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
