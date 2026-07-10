"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  CabinetFinishInsights,
  CabinetFinishInsightsSkeleton,
} from "@/components/admin/command-center/CabinetFinishInsights";
import {
  SystemAlertsBar,
  SystemAlertsBarSkeleton,
} from "@/components/admin/command-center/SystemAlertsBar";
import {
  AtRiskDealersPanel,
  AtRiskDealersPanelSkeleton,
} from "@/components/admin/command-center/AtRiskDealersPanel";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import {
  CheckCircleIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  PhoneIcon,
  ShieldIcon,
  ShoppingCartIcon,
  UsersIcon,
} from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { AdminDateRangePicker } from "@/components/admin/AdminDateRangePicker";
import { buildAdminDateRangeQuery, formatAdminDateRangeLabel } from "@/lib/admin-date-range";
import type { DashboardDateRange } from "@/lib/admin-dashboard-stats";
import { formatDate, formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type {
  AdminCommandCenterData,
  CommandCenterActivityTone,
} from "@/types/admin-command-center";
import type { AdminDashboardExtendedData } from "@/types/admin-dashboard-extended";
import type { AdminPermissions } from "@/types/admin-permissions";
import type { ChurnRadarResponse } from "@/types/churn-radar";
import { createEmptyAdminPermissions, hasAdminPermission } from "@/types/admin-permissions";

const SalesTrendChart = dynamic(
  () =>
    import("@/components/admin/command-center/SalesTrendChart").then(
      (module) => module.SalesTrendChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full rounded-2xl" />,
  }
);

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return formatDate(iso);
}

function activityDotClass(tone: CommandCenterActivityTone) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-500";
    case "amber":
      return "bg-amber-500";
    case "rose":
      return "bg-rose-500";
    case "brand":
      return "bg-brand";
    default:
      return "bg-slate-400";
  }
}

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accent?: "default" | "warning" | "success";
  trend?: { value: number | null; label: string };
};

function KpiCard({ label, value, hint, icon, accent = "default", trend }: KpiCardProps) {
  const valueClass =
    accent === "warning"
      ? "text-rose-700 dark:text-rose-300"
      : accent === "success"
        ? "text-slate-950 dark:text-cream"
        : "text-slate-950 dark:text-cream";

  return (
    <article className={`relative overflow-hidden p-5 shadow-sm ${ui.adminCard}`}>
      <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-600 dark:border-zinc-700/50 dark:bg-navy-hover dark:text-cream/70">
        {icon}
      </div>
      <p className={`pr-12 text-sm font-medium ${ui.bodyMuted}`}>{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${valueClass}`}>{value}</p>
      {trend && trend.value !== null && (
        <p
          className={`mt-2 text-xs font-semibold ${
            trend.value >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {trend.value >= 0 ? "+" : ""}
          {trend.value}% {trend.label}
        </p>
      )}
      {hint && !trend && <p className={`mt-2 text-xs ${ui.bodyMuted}`}>{hint}</p>}
      {hint && trend && <p className={`mt-1 text-xs ${ui.bodyMuted}`}>{hint}</p>}
    </article>
  );
}

function CommandCenterSkeleton() {
  return (
    <div className="space-y-6">
      <SystemAlertsBarSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <div className={`space-y-4 p-6 ${ui.adminCard}`}>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
        <div className={`space-y-4 p-6 ${ui.adminCard}`}>
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <CabinetFinishInsightsSkeleton />
      <AtRiskDealersPanelSkeleton />
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className={`space-y-3 p-6 ${ui.adminCard}`}>
            <Skeleton className="h-5 w-56" />
            {Array.from({ length: 4 }).map((__, row) => (
              <Skeleton key={row} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboard({
  dateRange,
  onDateRangeChange,
}: {
  dateRange: DashboardDateRange;
  onDateRangeChange: (range: DashboardDateRange | null) => void;
}) {
  const [data, setData] = useState<AdminCommandCenterData | null>(null);
  const [extended, setExtended] = useState<AdminDashboardExtendedData | null>(null);
  const [churnRadar, setChurnRadar] = useState<ChurnRadarResponse | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions>(createEmptyAdminPermissions());
  const [canViewChurnRadar, setCanViewChurnRadar] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingExtended, setIsLoadingExtended] = useState(true);
  const [isLoadingChurn, setIsLoadingChurn] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);

  const dateQuery = buildAdminDateRangeQuery(dateRange);

  const loadDashboard = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) {
      setIsLoading(true);
      setIsLoadingExtended(true);
      setIsLoadingChurn(true);
    } else {
      setIsRefreshing(true);
      setIsLoadingExtended(true);
      setExtended(null);
    }
    setError(null);

    try {
      const [dashboardResponse, extendedResponse, authResponse] = await Promise.all([
        fetch(`/api/admin/dashboard?${dateQuery}`, { cache: "no-store" }),
        fetch(`/api/admin/analytics/dashboard-extended?${dateQuery}`, { cache: "no-store" }),
        fetch("/api/auth/me", { cache: "no-store" }),
      ]);

      if (!dashboardResponse.ok) {
        throw new Error("Failed to load command center");
      }

      if (!extendedResponse.ok) {
        throw new Error("Failed to load extended analytics");
      }

      const dashboardPayload = (await dashboardResponse.json()) as AdminCommandCenterData;
      const extendedPayload = (await extendedResponse.json()) as AdminDashboardExtendedData;

      setData(dashboardPayload);
      setExtended(extendedPayload);
      hasLoadedRef.current = true;

      if (authResponse.ok) {
        const authPayload = (await authResponse.json()) as {
          permissions?: AdminPermissions | null;
        };
        const nextPermissions = authPayload.permissions ?? createEmptyAdminPermissions();
        setPermissions(nextPermissions);

        if (hasAdminPermission(nextPermissions, "can_view_churn_radar")) {
          const churnResponse = await fetch("/api/admin/analytics/churn-radar");

          if (churnResponse.ok) {
            setChurnRadar((await churnResponse.json()) as ChurnRadarResponse);
            setCanViewChurnRadar(true);
          } else if (churnResponse.status === 403) {
            setCanViewChurnRadar(false);
          } else {
            throw new Error("Failed to load churn radar");
          }
        } else {
          setCanViewChurnRadar(false);
        }
      } else {
        setCanViewChurnRadar(false);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      setIsLoading(false);
      setIsLoadingExtended(false);
      setIsLoadingChurn(false);
      setIsRefreshing(false);
    }
  }, [dateQuery]);

  useDeferredEffect(() => {
    void loadDashboard();
  }, [loadDashboard, dateRange.endDate, dateRange.startDate]);

  const approveTaxExemption = async (userId: number) => {
    setApprovingUserId(userId);

    try {
      const response = await fetch(`/api/admin/users/${userId}/approve-tax`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to approve tax exemption");
      }

      await loadDashboard();
    } catch (approveError) {
      setError(
        approveError instanceof Error ? approveError.message : "Failed to approve tax exemption"
      );
    } finally {
      setApprovingUserId(null);
    }
  };

  const dateRangeToolbar = (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <AdminDateRangePicker
        value={dateRange}
        menuAlign="right"
        onChange={onDateRangeChange}
        disabled={isRefreshing}
      />
    </div>
  );

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        {dateRangeToolbar}
        <CommandCenterSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        {dateRangeToolbar}
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button type="button" onClick={() => void loadDashboard()} className={`mt-4 ${ui.btnPrimary}`}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {dateRangeToolbar}
      </div>
    );
  }

  const { kpis, salesTrend, recentActivity, topAbandonedCarts, pendingTaxExemptions } = data;
  const hasSalesTrendData = salesTrend.some(
    (point) => point.completedOrderRevenue > 0 || point.clientQuoteRevenue > 0
  );

  return (
    <div className="space-y-6">
      {dateRangeToolbar}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {isLoadingExtended && !extended ? (
        <SystemAlertsBarSkeleton />
      ) : (
        extended && <SystemAlertsBar alerts={extended.alerts} />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isRefreshing ? (
          Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
        ) : (
          <>
            <KpiCard
              label="Revenue"
              value={formatPrice(kpis.monthlyRevenue)}
              icon={<CreditCardIcon size={18} />}
              trend={{
                value: kpis.monthlyRevenueChangePercent,
                label: "vs prior period",
              }}
            />
            <KpiCard
              label="Pending Approvals"
              value={String(kpis.pendingApprovals)}
              hint={`${kpis.pendingDealerApplications} dealers · ${kpis.pendingTaxExemptions} tax docs`}
              icon={<ShieldIcon size={18} />}
              accent="warning"
            />
            <KpiCard
              label="Recoverable Cart Revenue"
              value={formatPrice(kpis.recoverableHotCartRevenue)}
              hint={`${kpis.hotCartCount} HOT cart${kpis.hotCartCount === 1 ? "" : "s"} in last 24h`}
              icon={<ShoppingCartIcon size={18} />}
            />
            <KpiCard
              label="Active Dealers"
              value={String(kpis.activeDealersThisMonth)}
              hint={formatAdminDateRangeLabel(dateRange)}
              icon={<UsersIcon size={18} />}
            />
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <div className={`p-6 ${ui.adminCard}`}>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={ui.heading3}>Sales &amp; Quotes Trend</h2>
              <p className={`mt-1 ${ui.bodyMuted}`}>
                {formatAdminDateRangeLabel(dateRange)} — order revenue vs client quotes
              </p>
            </div>
            <Link
              href="/admin/orders"
              className="text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              View orders
            </Link>
          </div>
          {isRefreshing ? (
            <Skeleton className="h-72 w-full rounded-2xl" />
          ) : !hasSalesTrendData ? (
            <p className={`${ui.bodyMuted}`}>No trend data for this period.</p>
          ) : (
            <SalesTrendChart data={salesTrend} />
          )}
        </div>

        <div className={`p-6 ${ui.adminCard}`}>
          <div className="mb-5">
            <h2 className={ui.heading3}>Recent Action Pipeline</h2>
            <p className={`mt-1 ${ui.bodyMuted}`}>Live feed from the last 24 hours</p>
          </div>
          {isRefreshing ? (
            <div className="space-y-4" aria-hidden>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex gap-3">
                  <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <p className={`${ui.bodyMuted}`}>No activity in the last 24 hours.</p>
          ) : (
            <ul className="space-y-4">
              {recentActivity.map((activity) => (
                <li key={activity.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${activityDotClass(activity.tone)}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed text-slate-800 dark:text-cream/90">
                      {activity.message}
                    </p>
                    <p className={`mt-0.5 text-xs ${ui.bodyMuted}`}>
                      {relativeTime(activity.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {isLoadingExtended ? (
        <CabinetFinishInsightsSkeleton />
      ) : (
        extended && (
          <CabinetFinishInsights
            data={extended}
            dateRangeLabel={formatAdminDateRangeLabel(dateRange)}
          />
        )
      )}

      {canViewChurnRadar &&
        (isLoadingChurn && !churnRadar ? (
          <AtRiskDealersPanelSkeleton />
        ) : (
          churnRadar && (
            <AtRiskDealersPanel
              data={churnRadar}
              canIssueCoupons={hasAdminPermission(permissions, "can_manage_churn_recovery")}
              onCouponIssued={() => void loadDashboard()}
            />
          )
        ))}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className={`p-6 ${ui.adminCard}`}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={ui.heading3}>High-Value Abandoned Carts</h2>
              <p className={`mt-1 ${ui.bodyMuted}`}>Top 5 dealers by cart value</p>
            </div>
            <Link
              href="/admin/orders/abandoned-carts"
              className="text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              View all
            </Link>
          </div>
          {topAbandonedCarts.length === 0 ? (
            <p className={`${ui.bodyMuted}`}>No recoverable carts right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={ui.tableHead}>
                  <tr>
                    <th className={ui.tableHeadCell}>Dealer</th>
                    <th className={ui.tableHeadCell}>Phone</th>
                    <th className={ui.tableHeadCell}>Cart</th>
                    <th className={ui.tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {topAbandonedCarts.map((cart) => (
                    <tr key={cart.userId} className={ui.tableRow}>
                      <td className={ui.tableCell}>
                        <p className="font-semibold text-slate-900 dark:text-cream">
                          {cart.companyName}
                        </p>
                        <p className={`text-xs ${ui.bodyMuted}`}>{cart.email}</p>
                        {cart.temperature === "HOT" && (
                          <span className="mt-1 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                            HOT
                          </span>
                        )}
                      </td>
                      <td className={`${ui.tableCell} ${ui.bodyMuted}`}>
                        {cart.phone ? (
                          <a href={`tel:${cart.phone}`} className="hover:text-brand">
                            {cart.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                        {formatPrice(cart.cartTotal)}
                        <p className={`text-xs font-normal ${ui.bodyMuted}`}>
                          {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className={ui.tableCell}>
                        <div className="flex flex-wrap gap-2">
                          {cart.phone && (
                            <a
                              href={`tel:${cart.phone}`}
                              className={`${ui.btnSecondary} px-2.5 py-1.5 text-xs`}
                            >
                              <IconLabel icon={<PhoneIcon size={13} />}>Call</IconLabel>
                            </a>
                          )}
                          <Link
                            href={`/admin/orders/abandoned-carts?userId=${cart.userId}`}
                            className={`${ui.btnSecondary} px-2.5 py-1.5 text-xs`}
                          >
                            View cart
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={`p-6 ${ui.adminCard}`}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={ui.heading3}>Pending Tax Exemptions</h2>
              <p className={`mt-1 ${ui.bodyMuted}`}>Resale certificates awaiting review</p>
            </div>
            <Link
              href="/admin/users/tax-exemptions"
              className="text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              Review queue
            </Link>
          </div>
          {pendingTaxExemptions.length === 0 ? (
            <p className={`${ui.bodyMuted}`}>No pending tax exemption documents.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={ui.tableHead}>
                  <tr>
                    <th className={ui.tableHeadCell}>Dealer</th>
                    <th className={ui.tableHeadCell}>Submitted</th>
                    <th className={ui.tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTaxExemptions.map((item) => (
                    <tr key={item.userId} className={ui.tableRow}>
                      <td className={ui.tableCell}>
                        <p className="font-semibold text-slate-900 dark:text-cream">
                          {item.companyName?.trim() || item.contactName?.trim() || item.email}
                        </p>
                        <p className={`text-xs ${ui.bodyMuted}`}>{item.email}</p>
                      </td>
                      <td className={`${ui.tableCell} ${ui.bodyMuted}`}>
                        {formatDate(item.submittedAt)}
                      </td>
                      <td className={ui.tableCell}>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void approveTaxExemption(item.userId)}
                            disabled={approvingUserId === item.userId}
                            className={`${ui.btnPrimary} px-2.5 py-1.5 text-xs disabled:opacity-60`}
                          >
                            <IconLabel icon={<CheckCircleIcon size={13} />}>
                              {approvingUserId === item.userId ? "Saving..." : "Approve"}
                            </IconLabel>
                          </button>
                          {item.certificateUrl && (
                            <a
                              href={item.certificateUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`${ui.btnSecondary} px-2.5 py-1.5 text-xs`}
                            >
                              <IconLabel icon={<ExternalLinkIcon size={13} />}>
                                Review PDF
                              </IconLabel>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
