"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomerAvatar } from "@/components/admin/AdminOrdersStatCard";
import { OrderStatusEditor } from "@/components/admin/OrderStatusEditor";
import { ChevronDownIcon, PackageIcon } from "@/components/ui/Icon";
import {
  formatDate,
  formatPrice,
  orderStatusAccentClass,
  orderStatusSurfaceClass,
  statusBadgeClass,
  statusLabel,
} from "@/lib/order-display";
import type { OrderStatus } from "@/lib/order-status";
import { ui } from "@/lib/ui-classes";
import type { OrderItem, OrderWithCustomer } from "@/types/orders";

function AdminOrderItemsTable({ items }: { items: OrderItem[] }) {
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="overflow-x-auto">
      <div className="border-b border-slate-200/80 bg-slate-50/80 px-6 py-3 text-xs font-medium text-slate-600 dark:border-zinc-700/50 dark:bg-navy-hover/40 dark:text-cream/65">
        {items.length} product line{items.length === 1 ? "" : "s"} · {totalUnits} total unit
        {totalUnits === 1 ? "" : "s"}
      </div>
      <table className="min-w-full text-left text-sm">
        <thead className={ui.tableHead}>
          <tr>
            <th className={ui.tableHeadCell}>Product</th>
            <th className={ui.tableHeadCell}>Variant</th>
            <th className={ui.tableHeadCell}>Dimensions</th>
            <th className={ui.tableHeadCell}>Color</th>
            <th className={ui.tableHeadCell}>Qty</th>
            <th className={ui.tableHeadCell}>Unit</th>
            <th className={ui.tableHeadCell}>Line total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={ui.tableRow}>
              <td className={`${ui.tableCell} font-medium text-slate-900 dark:text-cream`}>
                {item.productName}
                <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-cream/60">
                  SKU {item.productSku}
                </span>
              </td>
              <td className={`${ui.tableCell} font-mono text-xs text-slate-500 dark:text-cream/75`}>
                {item.variantSku}
              </td>
              <td className={`${ui.tableCell} text-slate-500 dark:text-cream/75`}>
                {item.widthIn}&quot; × {item.heightIn}&quot; × {item.depthIn}&quot;
              </td>
              <td className={`${ui.tableCell} text-slate-500 dark:text-cream/75`}>{item.color}</td>
              <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                {item.quantity}
              </td>
              <td className={`${ui.tableCell} text-slate-500 dark:text-cream/75`}>
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
  );
}

type AdminOrderAccordionCardProps = {
  order: OrderWithCustomer;
  defaultOpen?: boolean;
  onStatusUpdated?: (orderId: number, status: OrderStatus) => void;
};

export function AdminOrderAccordionCard({
  order,
  defaultOpen = false,
  onStatusUpdated,
}: AdminOrderAccordionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = `admin-order-panel-${order.id}`;
  const headerId = `admin-order-header-${order.id}`;
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <article
      className={`overflow-hidden ${ui.adminCardInteractive} ${orderStatusSurfaceClass(order.status)} ${orderStatusAccentClass(order.status)}`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          id={headerId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((current) => !current)}
          className="flex flex-1 flex-col gap-4 px-5 py-5 text-left transition hover:bg-slate-50/80 sm:px-6 dark:hover:bg-navy-hover/40"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-cream">
                  Order #{order.id}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(order.status)}`}
                >
                  {statusLabel(order.status)}
                </span>
              </div>

              <CustomerAvatar
                companyName={order.customer.companyName}
                contactName={order.customer.contactName}
                email={order.customer.email}
              />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-cream/60">
                <span>{formatDate(order.createdAt)}</span>
                <span className="inline-flex items-center gap-1">
                  <PackageIcon size={13} />
                  {order.items.length} line{order.items.length === 1 ? "" : "s"} · {totalUnits} unit
                  {totalUnits === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-start gap-3">
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-cream/60">
                  Order total
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-brand">
                  {formatPrice(order.totalPrice)}
                </p>
              </div>
              <span
                className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition dark:border-zinc-600 dark:bg-navy-hover dark:text-cream/75 ${
                  isOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                <ChevronDownIcon size={18} />
              </span>
            </div>
          </div>
        </button>
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6 ${ui.adminActionBar}`}>
        <OrderStatusEditor
          orderId={order.id}
          status={order.status}
          compact
          onUpdated={(status) => onStatusUpdated?.(order.id, status)}
        />
        <Link href={`/admin/orders/${order.id}`} className={ui.btnSecondary}>
          View full invoice
        </Link>
      </div>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-200/80 dark:border-zinc-700/50">
            <AdminOrderItemsTable items={order.items} />
          </div>
          <div
            className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6 ${ui.adminActionBar}`}
          >
            <p className={`text-xs ${ui.bodyMuted}`}>
              Quick preview · {order.items.length} line{order.items.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
