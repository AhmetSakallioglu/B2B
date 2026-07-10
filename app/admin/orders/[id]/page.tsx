"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { EditOrderItemsModal } from "@/components/admin/EditOrderItemsModal";
import { CreateQuickBooksEstimateButton } from "@/components/admin/CreateQuickBooksEstimateButton";
import { ExportOrderPdfButton } from "@/components/admin/ExportOrderPdfButton";
import { ExportPackingListButton } from "@/components/orders/ExportPackingListButton";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSectionNav } from "@/components/admin/AdminOrdersSubNav";
import { AdminOrderSummaryBoard } from "@/components/admin/AdminOrderSummaryBoard";
import { OrderStatusEditor } from "@/components/admin/OrderStatusEditor";
import { LoadingState } from "@/components/ui/LoadingState";
import { Toast } from "@/components/ui/Toast";
import { ArrowLeftIcon, PackageIcon } from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatCustomerAddress } from "@/lib/customer-display";
import {
  formatDate,
  formatPrice,
  statusBadgeClass,
  statusLabel,
} from "@/lib/order-display";
import type { OrderStatus } from "@/lib/order-status";
import { isEditableOrderStatus } from "@/lib/order-status";
import { ui } from "@/lib/ui-classes";
import type { CompanyProfile } from "@/lib/company-profile";
import type { AdminPermissions } from "@/types/admin-permissions";
import { createEmptyAdminPermissions, hasAdminPermission } from "@/types/admin-permissions";
import type { OrderWithCustomer } from "@/types/orders";

function formatEin(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 9) {
    return value || "—";
  }

  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function OrderLineItemImage({ imageUrl, productName }: { imageUrl: string | null; productName: string }) {
  if (imageUrl) {
    return (
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200/60 bg-white p-1 dark:border-zinc-700/50 dark:bg-navy">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={productName}
          className="h-full w-full rounded-lg object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-slate-200/80 bg-slate-50 text-slate-400 dark:border-zinc-700/50 dark:bg-navy-hover dark:text-cream/50">
      <PackageIcon size={22} />
    </div>
  );
}

function AdminOrderDetailContent() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<OrderWithCustomer | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    description?: string;
    variant?: "success" | "error";
  } | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions>(
    createEmptyAdminPermissions()
  );
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isSavingModification, setIsSavingModification] = useState(false);

  const canEditOrderItems = useMemo(
    () =>
      hasAdminPermission(permissions, "can_edit_orders") &&
      Boolean(order && isEditableOrderStatus(order.status)),
    [permissions, order]
  );

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [orderResponse, profileResponse, sessionResponse] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}`),
        fetch("/api/company-profile"),
        fetch("/api/auth/me"),
      ]);

      if (orderResponse.status === 404) {
        setError("Order not found");
        return;
      }

      if (!orderResponse.ok) {
        throw new Error("Failed to load order");
      }

      const orderData = (await orderResponse.json()) as { order: OrderWithCustomer };
      setOrder(orderData.order);

      if (sessionResponse.ok) {
        const sessionData = (await sessionResponse.json()) as {
          permissions?: AdminPermissions | null;
        };
        setPermissions(sessionData.permissions ?? createEmptyAdminPermissions());
      }

      if (profileResponse.ok) {
        const profileData = (await profileResponse.json()) as { profile: CompanyProfile };
        setCompanyProfile(profileData.profile);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load order"
      );
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  const handleSaveModification = async (payload: {
    items: Array<{ itemId?: number; variantSku?: string; quantity: number }>;
  }) => {
    setIsSavingModification(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        outcome?: string;
        refundAmount?: number;
        balanceDelta?: number;
        checkoutUrl?: string;
        newTotalAmount?: number;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to modify order");
      }

      setEditModalOpen(false);
      await loadOrder();

      if (data.outcome === "refunded") {
        setToast({
          message: "Order updated with partial refund",
          description: data.refundAmount
            ? `Refunded ${formatPrice(data.refundAmount)} to the dealer card.`
            : "Order totals were reduced and saved.",
          variant: "success",
        });
      } else if (data.outcome === "awaiting_payment") {
        setToast({
          message: "Modification pending dealer payment",
          description:
            data.checkoutUrl ??
            "Order status set to Waiting for Modification Payment until the balance is paid.",
          variant: "success",
        });
      } else {
        setToast({
          message: "Order items updated",
          description: data.newTotalAmount
            ? `New order total: ${formatPrice(data.newTotalAmount)}`
            : undefined,
          variant: "success",
        });
      }
    } catch (saveError) {
      setToast({
        message: "Order modification failed",
        description:
          saveError instanceof Error ? saveError.message : "Unable to save changes",
        variant: "error",
      });
    } finally {
      setIsSavingModification(false);
    }
  };

  useDeferredEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  if (isLoading) {
    return <LoadingState label="Loading order..." minHeight="min-h-[320px]" spinnerSize="lg" />;
  }

  if (error || !order) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-300">{error ?? "Order not found"}</p>
        <Link href="/admin/orders" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
          Back to orders
        </Link>
      </div>
    );
  }

  const customer = order.customer;
  const dealerAddress = formatCustomerAddress(customer);

  return (
    <>
      <div className={`mb-6 ${ui.adminCard} px-5 py-4`}>
        <Link href="/admin/orders" className={ui.btnSecondary}>
          <IconLabel icon={<ArrowLeftIcon size={15} />}>Back to orders</IconLabel>
        </Link>
      </div>

      <article className={`overflow-hidden ${ui.adminCard}`}>
        <header className="border-b border-slate-200/80 bg-slate-50/80 px-6 py-5 dark:border-zinc-700/50 dark:bg-navy-hover/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={ui.eyebrow}>Order invoice</p>
              <h2 className={`mt-2 ${ui.heading1} text-2xl`}>Order #{order.id}</h2>
              <p className={`mt-1 ${ui.bodyMuted}`}>Placed {formatDate(order.createdAt)}</p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(order.status)}`}
                >
                  {statusLabel(order.status)}
                </span>
                <OrderStatusEditor
                  orderId={order.id}
                  status={order.status}
                  compact
                  onUpdated={(status: OrderStatus) =>
                    setOrder((current) => (current ? { ...current, status } : current))
                  }
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <CreateQuickBooksEstimateButton
                  orderId={order.id}
                  onSuccess={() =>
                    setToast({
                      message: "QuickBooks Estimate simulated successfully! (API connection pending)",
                      description: "A draft estimate was prepared for this dealer order.",
                      variant: "success",
                    })
                  }
                  onError={(message) =>
                    setToast({
                      message: "QuickBooks estimate failed",
                      description: message,
                      variant: "error",
                    })
                  }
                />
                <ExportOrderPdfButton order={order} />
                <ExportPackingListButton orderId={order.id} />
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-0 border-b border-slate-200/80 lg:grid-cols-2 dark:border-zinc-700/50">
          <section className="border-b border-slate-200/80 px-6 py-6 lg:border-b-0 lg:border-r dark:border-zinc-700/50">
            <p className={ui.fieldLabel}>From</p>
            <div className="mt-3 space-y-1 text-sm text-slate-800 dark:text-cream">
              {companyProfile?.name ? (
                <>
                  <p className="text-lg font-semibold text-slate-900 dark:text-cream">{companyProfile.name}</p>
                  {companyProfile.tagline && (
                    <p className={ui.bodyMuted}>{companyProfile.tagline}</p>
                  )}
                  {companyProfile.addressLine1 && <p>{companyProfile.addressLine1}</p>}
                  {companyProfile.cityLine && <p>{companyProfile.cityLine}</p>}
                  {companyProfile.phone && <p>{companyProfile.phone}</p>}
                  {companyProfile.email && <p>{companyProfile.email}</p>}
                </>
              ) : (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Company profile is not configured. Set{" "}
                  <code className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-navy-hover">
                    NEXT_PUBLIC_COMPANY_*
                  </code>{" "}
                  variables in <code className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-navy-hover">.env.local</code>{" "}
                  and restart the dev server.
                </p>
              )}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 dark:border-zinc-700/50 dark:bg-navy-hover/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-cream/60">
                  Order ID
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-cream">#{order.id}</p>
              </div>
              <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 dark:border-zinc-700/50 dark:bg-navy-hover/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-cream/60">
                  Order date
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-cream">
                  {formatDate(order.createdAt)}
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-6">
            <p className={ui.fieldLabel}>Bill to</p>
            <div className="mt-3 space-y-1 text-sm text-slate-800 dark:text-cream">
              {customer.companyName && (
                <p className="text-lg font-semibold text-slate-900 dark:text-cream">{customer.companyName}</p>
              )}
              {customer.contactName && (
                <p className={customer.companyName ? ui.bodyMuted : "text-lg font-semibold text-slate-900 dark:text-cream"}>
                  {customer.contactName}
                </p>
              )}
              <p>
                <span className="text-slate-500 dark:text-cream/60">EIN: </span>
                {formatEin(customer.federalTaxId)}
              </p>
              {dealerAddress.split("\n").map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>{customer.phone}</p>
              <p>{customer.email}</p>
            </div>
            <div className="mt-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
              Current Account Status: {order.pricing.tierName} (
              {Number.isInteger(order.pricing.tierDiscountPercent)
                ? order.pricing.tierDiscountPercent
                : order.pricing.tierDiscountPercent.toFixed(2)}
              % Off MSRP)
            </div>
          </section>
        </div>

        <div className="grid border-t border-slate-200/80 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem] dark:border-zinc-700/50">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-6 py-4 dark:border-zinc-700/50">
              <div>
                <p className={ui.fieldLabel}>Line items</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-cream">
                  {order.items.length} product{order.items.length === 1 ? "" : "s"} in this order
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEditOrderItems && (
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(true)}
                    className={ui.btnSecondary}
                  >
                    Edit Order Items
                  </button>
                )}
                <p className={`text-sm ${ui.bodyMuted}`}>
                  Unit prices reflect tier-adjusted dealer pricing
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={ui.tableHead}>
                  <tr>
                    <th className={ui.tableHeadCell}>Image</th>
                    <th className={ui.tableHeadCell}>SKU</th>
                    <th className={ui.tableHeadCell}>Product</th>
                    <th className={ui.tableHeadCell}>Dimensions (W/H/D)</th>
                    <th className={ui.tableHeadCell}>Qty</th>
                    <th className={ui.tableHeadCell}>Unit price</th>
                    <th className={ui.tableHeadCell}>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className={ui.tableRow}>
                      <td className={ui.tableCell}>
                        <OrderLineItemImage imageUrl={item.imageUrl} productName={item.productName} />
                      </td>
                      <td className={ui.tableCell}>
                        <p className="font-medium text-slate-900 dark:text-cream">{item.variantSku}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.productSku}</p>
                      </td>
                      <td className={ui.tableCell}>
                        <p className="font-medium text-slate-900 dark:text-cream">{item.productName}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-cream/60">{item.color}</p>
                      </td>
                      <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                        {item.widthIn}&quot; / {item.heightIn}&quot; / {item.depthIn}&quot;
                      </td>
                      <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                        {item.quantity}
                      </td>
                      <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                        {formatPrice(item.unitPrice)}
                      </td>
                      <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                        {formatPrice(item.unitPrice * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-slate-50/70 lg:border-t-0 lg:border-l dark:border-zinc-700/50 dark:bg-navy-hover/20">
            <AdminOrderSummaryBoard variant="sidebar" pricing={order.pricing} />
          </div>
        </div>
      </article>

      {toast && (
        <Toast
          message={toast.message}
          description={toast.description}
          variant={toast.variant ?? "success"}
          onClose={() => setToast(null)}
        />
      )}

      <EditOrderItemsModal
        open={editModalOpen}
        orderId={order.id}
        items={order.items}
        currentTotal={order.totalPrice}
        loading={isSavingModification}
        onConfirm={handleSaveModification}
        onCancel={() => {
          if (!isSavingModification) {
            setEditModalOpen(false);
          }
        }}
      />
    </>
  );
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  return (
    <AdminShell title={`Order #${orderId}`} subtitle="B2B order invoice and fulfillment detail" wide>
      <AdminSectionNav variant="orders" activeOrderTab="list" />
      <AdminOrderDetailContent />
    </AdminShell>
  );
}
