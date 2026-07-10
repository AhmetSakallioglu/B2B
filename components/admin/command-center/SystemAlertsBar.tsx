import Link from "next/link";
import type { DashboardSystemAlerts } from "@/types/admin-dashboard-extended";

type SystemAlertsBarProps = {
  alerts: DashboardSystemAlerts;
};

function alertLabel(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function SystemAlertsBar({ alerts }: SystemAlertsBarProps) {
  const items = [
    alerts.pendingDealerApplications > 0
      ? {
          key: "dealers",
          href: "/admin/users?status=pending",
          className:
            "border-amber-200/80 bg-amber-50/90 text-amber-950 hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100",
          icon: "⚠️",
          message: `${alertLabel(
            alerts.pendingDealerApplications,
            "New Dealer Application",
            "New Dealer Applications"
          )} awaiting verification.`,
        }
      : null,
    alerts.pendingFulfillmentOrders > 0
      ? {
          key: "orders",
          href: "/admin/orders",
          className:
            "border-sky-200/80 bg-sky-50/90 text-sky-950 hover:border-sky-300 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-100",
          icon: "📦",
          message: `${alertLabel(
            alerts.pendingFulfillmentOrders,
            "Order",
            "Orders"
          )} pending fulfillment processing.`,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    href: string;
    className: string;
    icon: string;
    message: string;
  }>;

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="grid gap-2 sm:grid-cols-2"
      aria-label="Critical system alerts"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm transition hover:shadow-md ${item.className}`}
        >
          <span aria-hidden className="text-base leading-none">
            {item.icon}
          </span>
          <span>{item.message}</span>
        </Link>
      ))}
    </section>
  );
}

export function SystemAlertsBarSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-hidden>
      <div className="h-[52px] animate-pulse rounded-xl border border-slate-100 bg-slate-100/80 dark:border-zinc-700/50 dark:bg-navy-hover/60" />
      <div className="h-[52px] animate-pulse rounded-xl border border-slate-100 bg-slate-100/80 dark:border-zinc-700/50 dark:bg-navy-hover/60" />
    </div>
  );
}
