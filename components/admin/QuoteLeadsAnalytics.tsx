"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import { HOT_LEAD_MIN_QUOTES, type QuoteCustomerAnalytics } from "@/types/quote-analytics";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type CopyField = "email" | "phone";

function CopyContactButton({
  value,
  field,
  disabled,
}: {
  value: string;
  field: CopyField;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (disabled || value === "—") {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const label = field === "email" ? "Email" : "Phone";

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={disabled || value === "—"}
      title={`Copy ${label.toLowerCase()}`}
      className={`${ui.btnSecondary} px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function QuoteLeadsAnalytics() {
  const [customers, setCustomers] = useState<QuoteCustomerAnalytics[]>([]);
  const [hotLeadCount, setHotLeadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/quotes/customer-analytics");

      if (!response.ok) {
        throw new Error("Failed to load quote analytics");
      }

      const data = (await response.json()) as {
        customers: QuoteCustomerAnalytics[];
        hotLeadCount: number;
      };

      setCustomers(data.customers);
      setHotLeadCount(data.hotLeadCount);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quote analytics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const hotLeads = useMemo(
    () => customers.filter((customer) => customer.isHotLead),
    [customers]
  );

  const totalPotentialRevenue = useMemo(
    () => customers.reduce((sum, customer) => sum + customer.totalPotentialRevenue, 0),
    [customers]
  );

  if (isLoading) {
    return <LoadingState label="Loading quote analytics..." minHeight="min-h-[320px]" spinnerSize="lg" />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void loadAnalytics()}
          className={`mt-4 ${ui.btnPrimary}`}
        >
          Retry
        </button>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className={`px-6 py-12 text-center ${ui.emptyState}`}>
        <p className="text-base font-semibold text-slate-900 dark:text-cream">No dealer quote activity yet</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-cream/60">
          Customer-level analytics will appear once dealers start saving quotes from their carts.
        </p>
      </div>
    );
  }

  return (
    <div className={ui.sectionStack}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className={`p-5 ${ui.adminCard}`}>
          <p className="text-sm font-medium text-slate-500 dark:text-cream/70">Active quote customers</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-cream">{customers.length}</p>
        </div>
        <div className={`border-brand/30 bg-brand-light/30 p-5 ${ui.adminCard}`}>
          <p className="text-sm font-medium text-brand">Combined potential revenue</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-brand">{formatPrice(totalPotentialRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-12px_rgba(0,0,0,0.05)] dark:border-amber-500/30 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Hot leads</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-amber-900 dark:text-amber-100">{hotLeadCount}</p>
          <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
            {HOT_LEAD_MIN_QUOTES}+ quotes, no orders yet
          </p>
        </div>
      </div>

      {hotLeads.length > 0 && (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/20">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            High-potential dealers (Hot Leads)
          </h3>
          <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">
            Dealers with more than {HOT_LEAD_MIN_QUOTES} saved quotes who have not placed an order yet.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {hotLeads.map((lead) => (
              <Link
                key={lead.userId}
                href={`/admin/quotes?tab=quotes&userId=${lead.userId}`}
                className={`${ui.btnSecondary} gap-2 px-3 py-1.5 text-sm hover:border-brand/40 hover:text-brand`}
              >
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Hot
                </span>
                {lead.companyName !== "—" ? lead.companyName : lead.contactName}
                <span className="text-xs text-slate-500 dark:text-cream/65">
                  {lead.totalQuotes} quotes · {formatPrice(lead.totalPotentialRevenue)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className={`overflow-hidden ${ui.adminCard}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={ui.tableHead}>
              <tr>
                <th className={ui.tableHeadCell}>Customer</th>
                <th className={ui.tableHeadCell}>Contact</th>
                <th className={ui.tableHeadCell}>Quotes</th>
                <th className={ui.tableHeadCell}>Potential revenue</th>
                <th className={ui.tableHeadCell}>Last activity</th>
                <th className={ui.tableHeadCell}>Orders</th>
                <th className={ui.tableHeadCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.userId} className={ui.tableRow}>
                  <td className={ui.tableCell}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-cream">
                        {customer.companyName !== "—" ? customer.companyName : customer.contactName}
                      </span>
                      {customer.isHotLead && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Hot Lead
                        </span>
                      )}
                    </div>
                    {customer.contactName !== "—" && customer.companyName !== "—" && (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-cream/60">{customer.contactName}</p>
                    )}
                  </td>
                  <td className={ui.tableCell}>
                    <p className="text-slate-900 dark:text-cream">{customer.email}</p>
                    <p className="text-xs text-slate-500 dark:text-cream/60">{customer.phone}</p>
                  </td>
                  <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                    {customer.totalQuotes}
                  </td>
                  <td className={`${ui.tableCell} font-semibold text-brand`}>
                    {formatPrice(customer.totalPotentialRevenue)}
                  </td>
                  <td className={`${ui.tableCell} text-slate-500 dark:text-cream/70`}>
                    {formatDate(customer.lastActivityAt)}
                  </td>
                  <td className={`${ui.tableCell} text-slate-800 dark:text-cream`}>{customer.orderCount}</td>
                  <td className={ui.tableCell}>
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyContactButton value={customer.email} field="email" />
                      <CopyContactButton value={customer.phone} field="phone" />
                      <Link
                        href={`/admin/quotes?tab=quotes&userId=${customer.userId}`}
                        className={`${ui.btnSecondary} px-3 py-1.5 text-xs`}
                      >
                        View customer&apos;s quotes
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
