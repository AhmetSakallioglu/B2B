"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { OrderAccordionCard } from "@/components/orders/OrderAccordionCard";
import {
  AccountBackToCatalogLink,
  AccountPageHeader,
} from "@/components/account/AccountPageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { ClipboardListIcon, CreditCardIcon, PackageIcon } from "@/components/ui/Icon";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { SessionUser } from "@/types/auth";
import type { Order } from "@/types/orders";

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justPlaced = searchParams.get("placed") === "1";
  const highlightedOrderId = searchParams.get("order");

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultOpenOrderId = useMemo(() => {
    if (highlightedOrderId) {
      const parsed = Number.parseInt(highlightedOrderId, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return orders.length === 1 ? orders[0].id : null;
  }, [highlightedOrderId, orders]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionResponse = await fetch("/api/auth/me");

      if (sessionResponse.status === 401) {
        router.replace("/login?redirect=/orders");
        return;
      }

      const sessionData = (await sessionResponse.json()) as { user: SessionUser };

      if (sessionData.user.role === "admin") {
        router.replace("/admin");
        return;
      }

      const ordersResponse = await fetch("/api/orders");

      if (!ordersResponse.ok) {
        throw new Error("Failed to load orders");
      }

      const ordersData = (await ordersResponse.json()) as { orders: Order[] };
      setOrders(ordersData.orders);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load orders"
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useDeferredEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  if (isLoading) {
    return <LoadingState fullScreen label="Loading your orders..." spinnerSize="lg" />;
  }

  if (error) {
    return (
      <div className={`flex min-h-full items-center justify-center px-4 ${ui.catalogPageBg}`}>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={loadOrders}
            className={`mt-4 ${ui.btnPrimary}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={ui.catalogPageBg}>
      <AccountPageHeader
        active="orders"
        icon={<PackageIcon size={26} />}
        title="My Orders"
        description="Track status, line items, and totals for every project order."
        action={<AccountBackToCatalogLink />}
      />

      <main className={`${ui.pageContainerNarrow} ${ui.sectionStack} py-8`}>
        {justPlaced && (
          <div className="rounded-2xl border border-emerald-200/80 bg-linear-to-r from-emerald-50 to-surface px-5 py-4 text-sm text-emerald-950 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-navy dark:text-emerald-100">
            Your order was placed successfully. Expand the order below to preview line items, then
            open the full order page if you need the complete summary.
          </div>
        )}

        {orders.some((order) => order.status === "waiting_for_modification_payment") && (
          <div className="rounded-2xl border border-amber-300/80 bg-amber-50 px-5 py-4 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
            One or more orders require an additional modification payment before production can
            continue. Open the order to pay the remaining balance.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`p-5 ${ui.catalogCard}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-cream/70">Total orders</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-cream">
                  {orders.length}
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-600 dark:bg-navy-hover dark:text-cream">
                <PackageIcon size={20} />
              </span>
            </div>
          </div>
          <div className={`border-brand/30 bg-brand-light/30 p-5 ${ui.catalogCard}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-brand">Total spent</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-brand">
                  {formatPrice(orders.reduce((sum, order) => sum + order.totalPrice, 0))}
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/30 bg-brand-light text-brand">
                <CreditCardIcon size={20} />
              </span>
            </div>
          </div>
        </div>

        {orders.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className={ui.heading2}>Order history</h2>
            </div>
            <span className={`hidden items-center gap-1.5 sm:inline-flex ${ui.btnSecondary} px-3 py-1.5 text-xs`}>
              <ClipboardListIcon size={14} />
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </span>
          </div>
        )}

        {orders.length === 0 ? (
          <div className={`px-6 py-20 text-center ${ui.emptyState}`}>
            <PackageIcon size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-base font-semibold text-slate-900 dark:text-cream">
              No orders yet
            </p>
            <p className={`mt-2 ${ui.bodyMuted}`}>
              Browse the catalog, add cabinets to your cart, and place your first order.
            </p>
            <Link href="/catalog" className={`mt-6 inline-flex ${ui.btnPrimary}`}>
              Go to catalog
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderAccordionCard
                key={order.id}
                order={order}
                defaultOpen={defaultOpenOrderId === order.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={<LoadingState fullScreen label="Loading orders..." spinnerSize="lg" />}
    >
      <OrdersContent />
    </Suspense>
  );
}
