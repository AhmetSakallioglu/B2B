"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatPrice, statusLabel } from "@/lib/order-display";
import type { OrderStatus } from "@/lib/order-status";
import { ui } from "@/lib/ui-classes";
import type { OrderCustomerSummary, OrderStatusBreakdown } from "@/types/order-customer-analytics";

const VIP_RANK_LABELS = ["1st", "2nd", "3rd"] as const;

function formatStatusBreakdown(breakdown: OrderStatusBreakdown) {
  return (Object.entries(breakdown) as Array<[OrderStatus, number]>)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${statusLabel(status)}`)
    .join(", ");
}

function VipBadge({ rank }: { rank: number }) {
  const label = VIP_RANK_LABELS[rank] ?? `${rank + 1}th`;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-amber-400 via-yellow-300 to-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow-sm ring-1 ring-amber-600/30">
      <span aria-hidden>★</span>
      VIP {label}
    </span>
  );
}

export function OrderCustomerSummaryPanel() {
  const [customers, setCustomers] = useState<OrderCustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummaries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/orders/customer-summary");

      if (!response.ok) {
        throw new Error("Failed to load customer purchase summary");
      }

      const data = (await response.json()) as { customers: OrderCustomerSummary[] };
      setCustomers(data.customers);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load customer purchase summary"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const vipDealers = useMemo(() => customers.slice(0, 3), [customers]);

  const totalLifetimeValue = useMemo(
    () => customers.reduce((sum, customer) => sum + customer.lifetimeValue, 0),
    [customers]
  );

  const totalOrderCount = useMemo(
    () => customers.reduce((sum, customer) => sum + customer.totalOrders, 0),
    [customers]
  );

  if (isLoading) {
    return (
      <LoadingState
        label="Loading customer purchase summary..."
        minHeight="min-h-[320px]"
        spinnerSize="lg"
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void loadSummaries()}
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
        <p className="text-base font-semibold text-slate-900 dark:text-cream">No customer orders yet</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-cream/60">
          Purchase analytics will appear once dealers start placing orders.
        </p>
      </div>
    );
  }

  return (
    <div className={ui.sectionStack}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className={`p-5 ${ui.adminCard}`}>
          <p className="text-sm font-medium text-slate-500 dark:text-cream/70">Ordering customers</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-cream">
            {customers.length}
          </p>
        </div>
        <div className={`border-brand/30 bg-brand-light/30 p-5 ${ui.adminCard}`}>
          <p className="text-sm font-medium text-brand">Combined lifetime value</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-brand">
            {formatPrice(totalLifetimeValue)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-cream/60">
            Confirmed &amp; completed orders only
          </p>
        </div>
        <div className={`p-5 ${ui.adminCard}`}>
          <p className="text-sm font-medium text-slate-500 dark:text-cream/70">Total orders placed</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-cream">
            {totalOrderCount}
          </p>
        </div>
      </div>

      {vipDealers.length > 0 && (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/20">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            VIP Dealers
          </h3>
          <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">
            Top {vipDealers.length} customers by recognized lifetime spending.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {vipDealers.map((dealer, index) => (
              <Link
                key={dealer.userId}
                href={`/admin/orders?tab=list&userId=${dealer.userId}`}
                className={`${ui.btnSecondary} gap-2 px-4 py-2.5 text-sm hover:border-brand/40 hover:text-brand`}
              >
                <VipBadge rank={index} />
                {dealer.companyName !== "—" ? dealer.companyName : dealer.contactName}
                <span className="text-xs text-slate-500 dark:text-cream/65">
                  {formatPrice(dealer.lifetimeValue)} LTV
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className={`overflow-hidden ${ui.adminCard}`}>
        <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-zinc-700/50 dark:bg-navy-hover/30 sm:px-6">
          <h2 className={ui.heading2}>Customer CRM</h2>
          <p className={`mt-1 ${ui.bodyMuted}`}>
            Lifetime value and order history by dealer account.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={ui.tableHead}>
              <tr>
                <th className={ui.tableHeadCell}>Customer</th>
                <th className={ui.tableHeadCell}>Contact</th>
                <th className={ui.tableHeadCell}>Orders</th>
                <th className={ui.tableHeadCell}>Lifetime value</th>
                <th className={ui.tableHeadCell}>AOV</th>
                <th className={ui.tableHeadCell}>Status mix</th>
                <th className={ui.tableHeadCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer, index) => (
                <tr key={customer.userId} className={ui.tableRow}>
                  <td className={ui.tableCell}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-cream">
                        {customer.companyName !== "—"
                          ? customer.companyName
                          : customer.contactName}
                      </span>
                      {index < 3 && <VipBadge rank={index} />}
                    </div>
                    {customer.contactName !== "—" && customer.companyName !== "—" && (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-cream/60">
                        {customer.contactName}
                      </p>
                    )}
                  </td>
                  <td className={ui.tableCell}>
                    <p className="text-slate-900 dark:text-cream">{customer.email}</p>
                    <p className="text-xs text-slate-500 dark:text-cream/60">{customer.phone}</p>
                  </td>
                  <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                    {customer.totalOrders}
                  </td>
                  <td className={`${ui.tableCell} font-semibold text-brand`}>
                    {formatPrice(customer.lifetimeValue)}
                  </td>
                  <td className={`${ui.tableCell} text-slate-800 dark:text-cream`}>
                    {formatPrice(customer.averageOrderValue)}
                  </td>
                  <td className={`${ui.tableCell} text-slate-500 dark:text-cream/70`}>
                    {formatStatusBreakdown(customer.statusBreakdown) || "—"}
                  </td>
                  <td className={ui.tableCell}>
                    <Link
                      href={`/admin/orders?tab=list&userId=${customer.userId}`}
                      className={`${ui.btnSecondary} px-3 py-1.5 text-xs`}
                    >
                      View all orders
                    </Link>
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
