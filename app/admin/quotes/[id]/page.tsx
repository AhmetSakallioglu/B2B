"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { AdminAlert, AdminButton, AdminFieldLabel, AdminInput } from "@/components/admin/admin-ui";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { ArrowLeftIcon } from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { AdminQuoteDetail } from "@/types/quotes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminQuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const quoteId = Number.parseInt(params.id, 10);
  const [quote, setQuote] = useState<AdminQuoteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);

  const loadQuote = useCallback(async () => {
    if (Number.isNaN(quoteId)) {
      setError("Invalid quote id");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}`);

      if (!response.ok) {
        throw new Error("Failed to load quote");
      }

      const data = (await response.json()) as { quote: AdminQuoteDetail };
      setQuote(data.quote);
      setDiscountPercent(String(data.quote.adminDiscountPercent ?? 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quote");
    } finally {
      setIsLoading(false);
    }
  }, [quoteId]);

  useDeferredEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const applySpecialDiscount = async () => {
    if (!quote) {
      return;
    }

    setIsSavingDiscount(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountPercent: Number.parseFloat(discountPercent) }),
      });

      const data = (await response.json()) as { quote?: AdminQuoteDetail; error?: string };

      if (!response.ok || !data.quote) {
        throw new Error(data.error ?? "Failed to apply special discount");
      }

      setQuote(data.quote);
      setDiscountPercent(String(data.quote.adminDiscountPercent ?? 0));
      setMessage(
        data.quote.adminDiscountPercent > 0
          ? `Special ${data.quote.adminDiscountPercent}% discount applied.`
          : "Special discount removed."
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to apply special discount");
    } finally {
      setIsSavingDiscount(false);
    }
  };

  return (
    <AdminShell
      title={quote?.quoteName ?? "Quote details"}
      subtitle={
        quote?.status === "archived"
          ? "This quote is archived and is excluded from pipeline statistics"
          : "Review cabinets, dimensions, and pricing in this saved draft"
      }
      wide
    >
      <div className="mb-6">
        <Link
          href={quote?.status === "archived" ? "/admin/quotes?tab=archived" : "/admin/quotes"}
          className={ui.btnSecondary}
        >
          <IconLabel icon={<ArrowLeftIcon size={15} />}>Back to quotes</IconLabel>
        </Link>
      </div>

      {isLoading ? (
        <LoadingState label="Loading quote..." minHeight="min-h-[320px]" spinnerSize="lg" />
      ) : !quote ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error ?? "Quote not found"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {message && <AdminAlert tone="success">{message}</AdminAlert>}
          {error && <AdminAlert tone="error">{error}</AdminAlert>}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className={`p-5 ${ui.adminCard}`}>
              <p className={ui.bodyMuted}>Dealer</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-cream">
                {quote.companyName || quote.contactName || quote.customerEmail}
              </p>
              <p className={`mt-1 text-sm ${ui.bodyMuted}`}>{quote.customerEmail}</p>
            </div>
            <div className={`border-brand/30 bg-brand-light/30 p-5 ${ui.adminCard}`}>
              <p className="text-sm font-medium text-brand">Total amount</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-brand">
                {formatPrice(quote.displayTotalAmount)}
              </p>
              {quote.adminDiscountPercent > 0 && (
                <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
                  {quote.adminDiscountPercent}% special discount · list {formatPrice(quote.totalAmount)}
                </p>
              )}
            </div>
            <div className={`p-5 ${ui.adminCard}`}>
              <p className={ui.bodyMuted}>Status</p>
              <p className="mt-1 text-lg font-semibold capitalize text-slate-900 dark:text-cream">
                {quote.status.replace("_", " ")}
              </p>
            </div>
            <div className={`p-5 ${ui.adminCard}`}>
              <p className={ui.bodyMuted}>Last updated</p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-cream">
                {formatDate(quote.updatedAt)}
              </p>
              <p className={`mt-2 text-xs ${ui.bodyMuted}`}>
                Created {formatDate(quote.createdAt)}
              </p>
            </div>
          </div>

          <section className={`p-5 ${ui.adminCard}`}>
            <h2 className={ui.heading3}>Special discount</h2>
            <p className={`mt-1 ${ui.bodyMuted}`}>
              Apply an extra percent off this quote. The dealer keeps the discounted total, and
              checkout from this quote uses the same discount.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block w-40 space-y-1.5">
                <AdminFieldLabel>Discount %</AdminFieldLabel>
                <AdminInput
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                />
              </label>
              <AdminButton
                type="button"
                variant="primary"
                disabled={isSavingDiscount}
                onClick={() => void applySpecialDiscount()}
              >
                {isSavingDiscount ? "Saving..." : "Apply discount"}
              </AdminButton>
            </div>
          </section>

          <section className={`overflow-hidden ${ui.adminCard}`}>
            <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-zinc-700/50 dark:bg-navy-hover/30">
              <h2 className={ui.heading3}>Line items</h2>
              <p className={`mt-1 ${ui.bodyMuted}`}>
                {quote.items.length} unique variant{quote.items.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={ui.tableHead}>
                  <tr>
                    <th className={ui.tableHeadCell}>Product</th>
                    <th className={ui.tableHeadCell}>Dimensions</th>
                    <th className={ui.tableHeadCell}>Qty</th>
                    <th className={ui.tableHeadCell}>Unit price</th>
                    <th className={ui.tableHeadCell}>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item) => (
                    <tr key={item.id} className={ui.tableRow}>
                      <td className={ui.tableCell}>
                        <div className="font-semibold text-slate-900 dark:text-cream">{item.name}</div>
                        <div className={`text-xs ${ui.bodyMuted}`}>SKU {item.id}</div>
                      </td>
                      <td className={`${ui.tableCell} text-slate-700 dark:text-cream/85`}>
                        {[item.width, item.height, item.depth].filter(Boolean).join(" × ") || "—"}
                      </td>
                      <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                        {item.quantity}
                      </td>
                      <td className={`${ui.tableCell} text-slate-700 dark:text-cream/85`}>
                        {formatPrice(item.price)}
                      </td>
                      <td className={`${ui.tableCell} font-bold text-brand`}>
                        {formatPrice(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
