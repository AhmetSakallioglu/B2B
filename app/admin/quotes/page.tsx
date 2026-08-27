"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { QuoteLeadsAnalytics } from "@/components/admin/QuoteLeadsAnalytics";
import { LoadingState } from "@/components/ui/LoadingState";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { AdminQuoteSummary } from "@/types/quotes";

type QuotesTab = "quotes" | "archived" | "analytics";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function parseTab(value: string | null): QuotesTab {
  if (value === "analytics" || value === "archived") {
    return value;
  }

  return "quotes";
}

function parseUserId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function AdminQuotesPage() {
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const filterUserId = parseUserId(searchParams.get("userId"));

  const [quotes, setQuotes] = useState<AdminQuoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/quotes${activeTab === "archived" ? "?archived=1" : ""}`
      );

      if (!response.ok) {
        throw new Error(activeTab === "archived" ? "Failed to load archived quotes" : "Failed to load quotes");
      }

      const data = (await response.json()) as { quotes: AdminQuoteSummary[] };
      setQuotes(data.quotes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quotes");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useDeferredEffect(() => {
    if (activeTab !== "analytics") {
      void loadQuotes();
    }
  }, [activeTab, loadQuotes]);

  const filteredQuotes = useMemo(() => {
    if (!filterUserId) {
      return quotes;
    }

    return quotes.filter((quote) => quote.userId === filterUserId);
  }, [filterUserId, quotes]);

  const filteredCustomerLabel = useMemo(() => {
    if (!filterUserId || filteredQuotes.length === 0) {
      return null;
    }

    const quote = filteredQuotes[0];
    return quote.companyName || quote.contactName || quote.customerEmail;
  }, [filterUserId, filteredQuotes]);

  const totalValue = filteredQuotes.reduce((sum, quote) => sum + quote.totalAmount, 0);

  return (
    <AdminShell
      title="Quote Management"
      subtitle="Review dealer quotes and follow up on high-potential leads"
      wide
    >
      <div className={`mb-8 ${ui.tabBar}`}>
        <Link
          href="/admin/quotes?tab=quotes"
          className={activeTab === "quotes" ? ui.tabActive : ui.tabIdle}
        >
          Active quotes
        </Link>
        <Link
          href="/admin/quotes?tab=archived"
          className={activeTab === "archived" ? ui.tabActive : ui.tabIdle}
        >
          Archive
        </Link>
        <Link
          href="/admin/quotes?tab=analytics"
          className={activeTab === "analytics" ? ui.tabActive : ui.tabIdle}
        >
          Leads &amp; analytics
        </Link>
      </div>

      {activeTab === "analytics" ? (
        <QuoteLeadsAnalytics />
      ) : isLoading ? (
        <LoadingState label="Loading quotes..." minHeight="min-h-[320px]" spinnerSize="lg" />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadQuotes()}
            className={`mt-4 ${ui.btnPrimary}`}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className={ui.sectionStack}>
          {filterUserId && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-light/30 px-4 py-3 dark:border-brand/30 dark:bg-brand-light/10">
              <p className="text-sm text-slate-800 dark:text-cream">
                Showing quotes for{" "}
                <span className="font-semibold">{filteredCustomerLabel ?? `customer #${filterUserId}`}</span>
              </p>
              <Link
                href={`/admin/quotes?tab=${activeTab}`}
                className="text-sm font-medium text-brand underline-offset-2 hover:underline"
              >
                Clear filter
              </Link>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className={`p-5 ${ui.adminCard}`}>
              <p className="text-sm font-medium text-slate-500 dark:text-cream/70">
                {activeTab === "archived" ? "Archived quotes" : "Open quotes"}
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-cream">
                {filteredQuotes.length}
              </p>
            </div>
            <div className={`border-brand/30 bg-brand-light/30 p-5 ${ui.adminCard}`}>
              <p className="text-sm font-medium text-brand">
                {activeTab === "archived" ? "Archived value" : "Combined draft value"}
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-brand">{formatPrice(totalValue)}</p>
            </div>
          </div>

          {filteredQuotes.length === 0 ? (
            <div className={`px-6 py-12 text-center ${ui.emptyState}`}>
              <p className="text-base font-semibold text-slate-900 dark:text-cream">
                {filterUserId
                  ? "No quotes for this customer"
                  : activeTab === "archived"
                    ? "No archived quotes"
                    : "No quotes saved yet"}
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-cream/60">
                {filterUserId
                  ? "This dealer has no quotes in this view."
                  : activeTab === "archived"
                    ? "Quotes archived by dealers or converted into orders will appear here. They are excluded from pipeline statistics."
                    : "Dealer quote drafts will appear here once they use Save as Quote on the cart page."}
              </p>
            </div>
          ) : (
            <div className={`overflow-hidden ${ui.adminCard}`}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={ui.tableHead}>
                    <tr>
                      <th className={ui.tableHeadCell}>Quote</th>
                      <th className={ui.tableHeadCell}>Dealer</th>
                      <th className={ui.tableHeadCell}>Items</th>
                      <th className={ui.tableHeadCell}>Total</th>
                      <th className={ui.tableHeadCell}>Updated</th>
                      <th className={ui.tableHeadCell}>Status</th>
                      <th className={ui.tableHeadCell} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.map((quote) => (
                      <tr key={quote.id} className={ui.tableRow}>
                        <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                          {quote.quoteName}
                        </td>
                        <td className={ui.tableCell}>
                          <div className="font-medium text-slate-900 dark:text-cream">
                            {quote.companyName || quote.contactName || quote.customerEmail}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-cream/60">
                            {quote.customerEmail}
                          </div>
                        </td>
                        <td className={`${ui.tableCell} text-slate-800 dark:text-cream`}>{quote.itemCount}</td>
                        <td className={`${ui.tableCell} font-semibold text-brand`}>
                          {formatPrice(quote.totalAmount)}
                        </td>
                        <td className={`${ui.tableCell} text-slate-500 dark:text-cream/70`}>
                          {formatDate(quote.updatedAt)}
                        </td>
                        <td className={`${ui.tableCell} capitalize text-slate-800 dark:text-cream`}>
                          {quote.status.replace("_", " ")}
                        </td>
                        <td className={`${ui.tableCell} text-right`}>
                          <Link
                            href={`/admin/quotes/${quote.id}${activeTab === "archived" ? "?from=archived" : ""}`}
                            className={`${ui.btnSecondary} px-3 py-1.5 text-xs`}
                          >
                            View details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
