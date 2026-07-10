"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { OrderDocumentActions } from "@/components/orders/OrderDocumentActions";
import { OrderItemsList } from "@/components/orders/OrderItemsList";
import { OrderModificationPaymentBanner } from "@/components/orders/OrderModificationPaymentBanner";
import { LoadingState } from "@/components/ui/LoadingState";
import { ArrowLeftIcon, PackageIcon } from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import {
  formatDate,
  formatPrice,
  orderStatusAccentClass,
  statusBadgeClass,
  statusLabel,
} from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { Order } from "@/types/orders";

function OrderDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPayingModification, setIsPayingModification] = useState(false);

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}`);

      if (response.status === 401) {
        router.replace(`/login?redirect=/orders/${orderId}`);
        return;
      }

      if (response.status === 404) {
        setError("Order not found");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load order");
      }

      const data = (await response.json()) as { order: Order };
      setOrder(data.order);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load order"
      );
    } finally {
      setIsLoading(false);
    }
  }, [orderId, router]);

  useDeferredEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useDeferredEffect(() => {
    const modificationPaid = searchParams.get("modificationPaid") === "1";
    const sessionId = searchParams.get("session_id");

    if (!modificationPaid || !sessionId || !order) {
      return;
    }

    void (async () => {
      const response = await fetch(`/api/orders/${orderId}/modification-payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        await loadOrder();
        router.replace(`/orders/${orderId}`);
      }
    })();
  }, [loadOrder, order, orderId, router, searchParams]);

  const handlePayModification = async () => {
    setIsPayingModification(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/modification-payment`, {
        method: "POST",
      });

      const data = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Unable to start checkout");
      }

      window.location.href = data.checkoutUrl;
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : "Payment failed");
      setIsPayingModification(false);
    }
  };

  if (isLoading) {
    return <LoadingState fullScreen label="Loading order..." spinnerSize="lg" />;
  }

  if (error || !order) {
    return (
      <div className={`flex min-h-full items-center justify-center px-4 ${ui.catalogPageBg}`}>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error ?? "Order not found"}</p>
          <Link href="/orders" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={ui.catalogPageBg}>
      <AccountPageHeader
        active="orders"
        icon={<PackageIcon size={26} />}
        title={`Order #${order.id}`}
        description={`Placed ${formatDate(order.createdAt)} · ${totalUnits} unit${totalUnits === 1 ? "" : "s"}`}
        action={
          <Link href="/orders" className={`${ui.btnSecondary} shrink-0`}>
            <IconLabel icon={<ArrowLeftIcon size={15} />}>All orders</IconLabel>
          </Link>
        }
      />

      <main className={`${ui.pageContainerNarrow} space-y-6 py-8`}>
        {order.status === "waiting_for_modification_payment" &&
          order.modificationPayment && (
            <OrderModificationPaymentBanner
              orderId={order.id}
              balanceDue={order.modificationPayment.balanceDue}
              loading={isPayingModification}
              onPay={() => void handlePayModification()}
            />
          )}

        <article
          className={`overflow-hidden ${ui.catalogCard} ${orderStatusAccentClass(order.status)}`}
        >
          <header className="border-b border-slate-200/80 bg-slate-50/80 px-6 py-5 dark:border-zinc-700/50 dark:bg-navy-hover/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span
                  className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(order.status)}`}
                >
                  {statusLabel(order.status)}
                </span>
                <p className={`mt-3 ${ui.bodyMuted}`}>
                  {order.items.length} line{order.items.length === 1 ? "" : "s"} · {totalUnits} unit
                  {totalUnits === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-cream/60">
                  Order total
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-brand">
                  {formatPrice(order.totalPrice)}
                </p>
                <div className="mt-4">
                  <OrderDocumentActions order={order} />
                </div>
              </div>
            </div>
          </header>

          <OrderItemsList items={order.items} />

          {(order.pricing.taxAmount > 0 || order.pricing.couponDiscountAmount > 0) && (
            <div className="border-t border-slate-200/80 px-6 py-4 dark:border-zinc-700/50">
              <div className="ml-auto max-w-sm space-y-2 text-sm">
                {order.pricing.couponDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                    <span>Coupon</span>
                    <span>-{formatPrice(order.pricing.couponDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-cream/75">
                  <span>Subtotal</span>
                  <span>{formatPrice(order.pricing.taxableSubtotal)}</span>
                </div>
                {order.pricing.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-cream/75">
                    <span>
                      Estimated Tax ({(order.pricing.taxRate * 100).toFixed(2)}%)
                    </span>
                    <span>{formatPrice(order.pricing.taxAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <footer className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 ${ui.adminActionBar}`}>
            <p className={ui.bodyMuted}>
              Order #{order.id} · {formatDate(order.createdAt)}
            </p>
            <p className="text-lg font-bold text-brand">{formatPrice(order.totalPrice)}</p>
          </footer>
        </article>
      </main>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<LoadingState fullScreen label="Loading order..." spinnerSize="lg" />}>
      <OrderDetailContent />
    </Suspense>
  );
}
