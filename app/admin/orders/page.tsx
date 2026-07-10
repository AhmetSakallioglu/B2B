"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminDateRangePicker } from "@/components/admin/AdminDateRangePicker";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSectionNav } from "@/components/admin/AdminOrdersSubNav";
import { AdminOrdersStatCard } from "@/components/admin/AdminOrdersStatCard";
import { OrderCustomerSummaryPanel } from "@/components/admin/OrderCustomerSummaryPanel";
import { LoadingState } from "@/components/ui/LoadingState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import {
  ClipboardListIcon,
  CreditCardIcon,
  PackageIcon,
  SearchIcon,
} from "@/components/ui/Icon";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AdminOrderAccordionCard } from "@/components/orders/AdminOrderAccordionCard";
import type { DashboardDateRange } from "@/lib/admin-dashboard-stats";
import { formatPrice, statusLabel } from "@/lib/order-display";
import { isRecognizedOrderStatus } from "@/lib/order-status";
import { ui } from "@/lib/ui-classes";
import { ADMIN_ORDER_LIST_FILTER_VALUES } from "@/types/admin-search-sanitization";
import type { AdminOrderListFilter } from "@/types/admin-search-sanitization";
import type { OrderWithCustomer } from "@/types/orders";
import type { OrderStatus } from "@/lib/order-status";

type OrdersTab = "list" | "customers";

function parseTab(value: string | null): OrdersTab {
  return value === "customers" ? "customers" : "list";
}

function parseUserId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseStatusFilter(value: string | null): AdminOrderListFilter {
  if (!value) {
    return "all";
  }

  return (ADMIN_ORDER_LIST_FILTER_VALUES as readonly string[]).includes(value)
    ? (value as AdminOrderListFilter)
    : "all";
}

function buildPageQueryString(params: {
  tab: OrdersTab;
  userId: number | null;
  status: AdminOrderListFilter;
  search: string;
  dateRange: DashboardDateRange | null;
}) {
  const query = new URLSearchParams();

  if (params.tab === "customers") {
    query.set("tab", "customers");
  }

  if (params.userId) {
    query.set("userId", String(params.userId));
  }

  if (params.status !== "all") {
    query.set("status", params.status);
  }

  if (params.search.trim()) {
    query.set("q", params.search.trim());
  }

  if (params.dateRange?.startDate && params.dateRange?.endDate) {
    query.set("startDate", params.dateRange.startDate);
    query.set("endDate", params.dateRange.endDate);
  }

  return query.toString();
}

function buildApiQueryString(searchParams: URLSearchParams) {
  const query = new URLSearchParams();

  const userId = searchParams.get("userId");
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (userId) {
    query.set("userId", userId);
  }

  if (status && status !== "all") {
    query.set("status", status);
  }

  if (q?.trim()) {
    query.set("q", q.trim());
  }

  if (startDate && endDate) {
    query.set("startDate", startDate);
    query.set("endDate", endDate);
  }

  return query.toString();
}

function AdminOrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const filterUserId = parseUserId(searchParams.get("userId"));
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const urlSearch = searchParams.get("q") ?? "";
  const dateRange = useMemo(() => {
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return null;
    }

    return { startDate, endDate };
  }, [searchParams]);

  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const hasLoadedOrdersRef = useRef(false);

  const apiQuery = useMemo(() => buildApiQueryString(searchParams), [searchParams]);

  const updatePageQuery = useCallback(
    (next: {
      status?: AdminOrderListFilter;
      search?: string;
      dateRange?: DashboardDateRange | null;
    }) => {
      const query = buildPageQueryString({
        tab: activeTab,
        userId: filterUserId,
        status: next.status ?? statusFilter,
        search: next.search ?? urlSearch,
        dateRange: next.dateRange === undefined ? dateRange : next.dateRange,
      });

      router.replace(query ? `/admin/orders?${query}` : "/admin/orders");
    },
    [activeTab, dateRange, filterUserId, router, statusFilter, urlSearch]
  );

  const loadOrders = useCallback(async () => {
    if (!hasLoadedOrdersRef.current) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const response = await fetch(
        apiQuery ? `/api/admin/orders?${apiQuery}` : "/api/admin/orders"
      );

      if (!response.ok) {
        throw new Error("Failed to load orders");
      }

      const data = (await response.json()) as { orders: OrderWithCustomer[] };
      setOrders(data.orders);
      hasLoadedOrdersRef.current = true;
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load orders"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiQuery]);

  useDeferredEffect(() => {
    if (activeTab !== "list") {
      return;
    }

    void loadOrders();
  }, [activeTab, apiQuery, loadOrders]);

  useDeferredEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useDeferredEffect(() => {
    if (debouncedSearch === urlSearch) {
      return;
    }

    updatePageQuery({ search: debouncedSearch });
  }, [debouncedSearch, updatePageQuery, urlSearch]);

  const filteredCustomerLabel = useMemo(() => {
    if (!filterUserId || orders.length === 0) {
      return null;
    }

    const order = orders.find((entry) => entry.customer.id === filterUserId);
    if (!order) {
      return null;
    }

    const customer = order.customer;
    return customer.companyName || customer.contactName || customer.email;
  }, [filterUserId, orders]);

  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const recognizedRevenue = orders
    .filter((order) => isRecognizedOrderStatus(order.status))
    .reduce((sum, order) => sum + order.totalPrice, 0);
  const pendingRevenue = orders
    .filter((order) => order.status === "pending")
    .reduce((sum, order) => sum + order.totalPrice, 0);

  const hasActiveFilters =
    Boolean(dateRange) || statusFilter !== "all" || urlSearch.trim().length > 0;

  return (
    <AdminShell title="Order Management" subtitle="Review, confirm, and fulfill cabinet orders" wide>
      <AdminSectionNav
        variant="orders"
        activeOrderTab={activeTab === "customers" ? "customers" : "list"}
      />

      {activeTab === "customers" ? (
        <OrderCustomerSummaryPanel />
      ) : isLoading && orders.length === 0 ? (
        <LoadingState label="Loading orders..." minHeight="min-h-[320px]" spinnerSize="lg" />
      ) : error && orders.length === 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className={`mt-4 ${ui.btnPrimary}`}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className={ui.sectionStack}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isRefreshing ? (
              Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
            ) : (
              <>
                <AdminOrdersStatCard
                  label="Matching orders"
                  value={String(orders.length)}
                  hint="Server-filtered results"
                  icon={<PackageIcon size={20} />}
                  accent="default"
                />
                <AdminOrdersStatCard
                  label="Pending review"
                  value={String(pendingCount)}
                  hint="Awaiting confirmation"
                  icon={<ClipboardListIcon size={20} />}
                  accent="amber"
                />
                <AdminOrdersStatCard
                  label="Recognized revenue"
                  value={formatPrice(recognizedRevenue)}
                  hint="Confirmed & completed"
                  icon={<CreditCardIcon size={20} />}
                  accent="emerald"
                />
                <AdminOrdersStatCard
                  label="Pending revenue"
                  value={formatPrice(pendingRevenue)}
                  hint="Not in dashboard totals"
                  icon={<CreditCardIcon size={20} />}
                  accent="blue"
                />
              </>
            )}
          </div>

          <section className={ui.adminCard}>
            <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-5 dark:border-zinc-700/50 dark:bg-navy-hover/30 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className={ui.heading2}>Search &amp; filter</h2>
                  <p className={`mt-1.5 ${ui.bodyMuted}`}>
                    Find orders by date, status, order number, or dealer name.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:max-w-3xl lg:justify-end">
                  <div className="relative z-20">
                    <AdminDateRangePicker
                    value={dateRange}
                    allowClear
                    label="Created between"
                    placeholder="All dates"
                    menuAlign="left"
                    onChange={(range) => updatePageQuery({ dateRange: range })}
                      disabled={isRefreshing}
                    />
                  </div>

                  <label className="flex w-full flex-col gap-1 text-xs font-medium text-slate-500 dark:text-cream/60 sm:min-w-[11rem] sm:w-auto">
                    Status
                    <select
                      value={statusFilter}
                      disabled={isRefreshing}
                      onChange={(event) =>
                        updatePageQuery({
                          status: parseStatusFilter(event.target.value),
                        })
                      }
                      className={`${ui.select} w-full`}
                    >
                      {ADMIN_ORDER_LIST_FILTER_VALUES.map((status) => (
                        <option key={status} value={status}>
                          {status === "all" ? "All statuses" : statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-cream/60">
                    Search
                    <div className="relative">
                      <SearchIcon
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="search"
                        value={searchInput}
                        disabled={isRefreshing}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Order #, dealer, company..."
                        className={`${ui.input} pl-11`}
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {filterUserId && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand/20 bg-brand-light/30 px-5 py-3 dark:border-brand/25 dark:bg-brand-light/10 sm:px-6">
                <p className="text-sm text-slate-800 dark:text-cream">
                  Filtered to{" "}
                  <span className="font-semibold">{filteredCustomerLabel ?? "selected customer"}</span>
                </p>
                <Link
                  href="/admin/orders?tab=list"
                  className="text-sm font-medium text-brand underline underline-offset-2"
                >
                  Clear filter
                </Link>
              </div>
            )}
          </section>

          <section className={`relative p-5 sm:p-6 ${ui.adminCard}`}>
            {isRefreshing && (
              <div className="absolute inset-0 z-10 rounded-[inherit] bg-white/55 p-5 backdrop-blur-[1px] dark:bg-navy/55 sm:p-6">
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full rounded-2xl" />
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className={ui.heading2}>Recent orders</h2>
                <p className={`mt-1.5 ${ui.bodyMuted}`}>
                  {orders.length} result{orders.length === 1 ? "" : "s"}
                  {urlSearch.trim() ? ` for “${urlSearch.trim()}”` : ""}
                </p>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  disabled={isRefreshing}
                  onClick={() => {
                    setSearchInput("");
                    router.replace(
                      filterUserId ? `/admin/orders?userId=${filterUserId}` : "/admin/orders"
                    );
                  }}
                  className={ui.btnSecondary}
                >
                  Reset filters
                </button>
              )}
            </div>

            {orders.length === 0 ? (
              <div className={`px-6 py-16 text-center ${ui.emptyState}`}>
                <SearchIcon size={36} className="mx-auto text-slate-300" />
                <p className="mt-4 text-base font-semibold text-slate-900 dark:text-cream">
                  No matching orders
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-cream/60">
                  Try another search term, status filter, or date range.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <AdminOrderAccordionCard
                    key={order.id}
                    order={order}
                    onStatusUpdated={(orderId, status: OrderStatus) =>
                      setOrders((current) =>
                        current.map((item) =>
                          item.id === orderId ? { ...item, status } : item
                        )
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={<LoadingState label="Loading orders..." minHeight="min-h-[320px]" spinnerSize="lg" />}
    >
      <AdminOrdersPageContent />
    </Suspense>
  );
}
