"use client";

import { FormEvent, Fragment, useCallback, useMemo, useState } from "react";
import { AdminOrdersStatCard } from "@/components/admin/AdminOrdersStatCard";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSectionNav } from "@/components/admin/AdminOrdersSubNav";
import { AdminButton, AdminFieldLabel, AdminSelect } from "@/components/admin/admin-ui";
import { LoadingState } from "@/components/ui/LoadingState";
import { ChevronDownIcon, MailIcon, PhoneIcon, ShoppingCartIcon } from "@/components/ui/Icon";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatDimensionsWHD } from "@/lib/format-dimensions";
import { formatDate, formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import {
  CART_TEMPERATURE_BADGE_CLASS,
  CART_TEMPERATURE_GUIDE,
  CART_TEMPERATURE_LABELS,
  CART_TEMPERATURE_SORT_ORDER,
  HOT_ACTIVITY_HOURS,
  HOT_CART_TOTAL_MIN,
  getCartTemperatureDetail,
  type AbandonedCartAnalyticsResponse,
  type AbandonedCartAnalyticsRow,
  type CartAbandonmentTemperature,
} from "@/types/abandoned-cart-analytics";
import type { EmailTemplate } from "@/types/email-template";

function dealerLabel(cart: AbandonedCartAnalyticsRow) {
  return cart.companyName?.trim() || cart.contactName?.trim() || cart.email;
}

function formatPhoneHref(phone: string | null) {
  if (!phone?.trim()) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return `tel:${digits}`;
}

function SendCartReminderModal({
  cart,
  onClose,
  onSent,
}: {
  cart: AbandonedCartAnalyticsRow;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/email-templates");

      if (!response.ok) {
        throw new Error("Failed to load email templates");
      }

      const data = (await response.json()) as { templates: EmailTemplate[] };
      const activeTemplates = data.templates.filter((template) => template.isActive);
      setTemplates(activeTemplates);
      setTemplateId(String(activeTemplates[0]?.id ?? ""));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load templates");
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/abandoned-carts/send-manual-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: cart.userId,
          templateId: Number.parseInt(templateId, 10),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to send reminder email");
      }

      onSent(payload?.message ?? "Reminder email sent.");
      onClose();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send reminder email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close reminder email dialog"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className={`relative z-10 w-full max-w-lg overflow-hidden ${ui.adminCard} shadow-2xl`}
      >
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <h2 className={ui.heading2}>Send cart reminder</h2>
          <p className={`mt-1 ${ui.bodyMuted}`}>
            {dealerLabel(cart)} · {formatPrice(cart.cartTotal)}
          </p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          {isLoadingTemplates ? (
            <LoadingState label="Loading templates..." minHeight="min-h-[120px]" />
          ) : templates.length === 0 ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              No active email templates available. Create one under Campaigns → Email templates.
            </p>
          ) : (
            <div>
              <AdminFieldLabel>Email template</AdminFieldLabel>
              <AdminSelect
                id="cart-reminder-template"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </AdminSelect>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <AdminButton type="button" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton
            type="submit"
            disabled={isSending || isLoadingTemplates || templates.length === 0}
          >
            {isSending ? "Sending..." : "Send reminder"}
          </AdminButton>
        </div>
      </form>
    </div>
  );
}

function CartTemperatureGuide() {
  const tiers: CartAbandonmentTemperature[] = ["HOT", "WARM", "COLD"];

  return (
    <div className={`mb-6 overflow-hidden ${ui.adminCard}`}>
      <div className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
        <h2 className={ui.heading3}>Lead temperature guide</h2>
        <p className={`mt-1 ${ui.bodyMuted}`}>
          Each cart is scored by cart value and how recently the dealer touched their cart. Hot
          leads appear first in the table below.
        </p>
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-3 sm:px-6">
        {tiers.map((tier) => (
          <div
            key={tier}
            className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-4 dark:border-zinc-700/50 dark:bg-navy-hover/20"
          >
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${CART_TEMPERATURE_BADGE_CLASS[tier]}`}
            >
              {CART_TEMPERATURE_LABELS[tier]}
            </span>
            <p className="mt-3 text-sm text-slate-700 dark:text-cream/85">
              {CART_TEMPERATURE_GUIDE[tier].description}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-cream/60">
              {CART_TEMPERATURE_GUIDE[tier].action}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartItemsAccordion({ cart }: { cart: AbandonedCartAnalyticsRow }) {
  return (
    <div className="border-t border-slate-200/80 bg-slate-50/70 px-4 py-4 dark:border-zinc-700/50 dark:bg-navy-hover/20 sm:px-6">
      <div className="space-y-2">
        {cart.items.map((item) => (
          <div
            key={`${cart.userId}-${item.productSku}-${item.widthIn}-${item.heightIn}-${item.depthIn}-${item.color}`}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-zinc-700/50 dark:bg-navy"
          >
            <div>
              <p className="font-semibold uppercase tracking-wide text-slate-900 dark:text-cream">
                {item.productSku}
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-cream/80">{item.productName}</p>
              <p className={`mt-1 text-sm ${ui.bodyMuted}`}>
                {item.color} ·{" "}
                {formatDimensionsWHD(item.widthIn, item.heightIn, item.depthIn)}
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-cream">Qty {item.quantity}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AbandonedCartAnalyticsPanel() {
  const [analytics, setAnalytics] = useState<AbandonedCartAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [reminderCart, setReminderCart] = useState<AbandonedCartAnalyticsRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/analytics/abandoned-carts");

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to load abandoned cart analytics");
      }

      const data = (await response.json()) as AbandonedCartAnalyticsResponse;
      setAnalytics(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load abandoned cart analytics"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const metrics = analytics?.metrics;
  const carts = useMemo(() => {
    const rows = analytics?.carts ?? [];

    return [...rows].sort((left, right) => {
      const temperatureDiff =
        CART_TEMPERATURE_SORT_ORDER[left.temperature] -
        CART_TEMPERATURE_SORT_ORDER[right.temperature];

      if (temperatureDiff !== 0) {
        return temperatureDiff;
      }

      if (right.cartTotal !== left.cartTotal) {
        return right.cartTotal - left.cartTotal;
      }

      return new Date(right.lastActiveAt).getTime() - new Date(left.lastActiveAt).getTime();
    });
  }, [analytics?.carts]);

  return (
    <AdminShell
      title="Cart abandonment analytics"
      subtitle="Track recoverable dealer revenue and prioritize hot sales follow-ups."
      wide
    >
      <AdminSectionNav variant="orders" activeOrderTab="abandoned-carts" />

      {toast && (
        <div className={`mb-6 px-4 py-3 text-sm ${ui.cardMuted}`}>
          {toast}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminOrdersStatCard
          label="Total recoverable revenue"
          value={formatPrice(metrics?.totalRecoverableRevenue ?? 0)}
          hint="Open carts not yet converted to orders"
          accent="brand"
          icon={<ShoppingCartIcon size={20} />}
        />
        <AdminOrdersStatCard
          label="Hot leads count"
          value={String(metrics?.hotLeadsCount ?? 0)}
          hint={`Carts over $${HOT_CART_TOTAL_MIN.toLocaleString()} with activity in the last ${HOT_ACTIVITY_HOURS} hours`}
          accent="amber"
        />
        <AdminOrdersStatCard
          label="Top abandoned item"
          value={metrics?.topAbandonedItem?.productSku ?? "—"}
          hint={
            metrics?.topAbandonedItem
              ? `${metrics.topAbandonedItem.quantity} units waiting in carts`
              : "No open carts right now"
          }
          accent="blue"
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading cart abandonment analytics..." minHeight="min-h-[320px]" spinnerSize="lg" />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button type="button" onClick={() => void loadAnalytics()} className={`mt-4 ${ui.btnPrimary}`}>
            Retry
          </button>
        </div>
      ) : carts.length === 0 ? (
        <div className={`px-6 py-12 text-center ${ui.emptyState}`}>
          <ShoppingCartIcon size={40} className="mx-auto text-slate-300" />
          <p className="mt-4 text-base font-semibold text-slate-900 dark:text-cream">
            No recoverable abandoned carts
          </p>
          <p className={`mt-2 ${ui.bodyMuted}`}>
            Dealers with open carts that have not converted will appear here for sales follow-up.
          </p>
        </div>
      ) : (
        <>
          <CartTemperatureGuide />

          <div className={`overflow-hidden ${ui.adminCard}`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={ui.tableHead}>
                <tr>
                  <th className={ui.tableHeadCell}>Dealer</th>
                  <th className={ui.tableHeadCell}>Contact</th>
                  <th className={ui.tableHeadCell}>Phone</th>
                  <th className={ui.tableHeadCell}>Cart total</th>
                  <th className={ui.tableHeadCell}>Last activity</th>
                  <th className={ui.tableHeadCell}>Temperature</th>
                  <th className={ui.tableHeadCell} />
                </tr>
              </thead>
              <tbody>
                {carts.map((cart) => {
                  const phoneHref = formatPhoneHref(cart.phone);
                  const isExpanded = expandedUserId === cart.userId;

                  return (
                    <Fragment key={cart.userId}>
                      <tr className={ui.tableRow}>
                        <td className={ui.tableCell}>
                          <p className="font-semibold text-slate-900 dark:text-cream">
                            {dealerLabel(cart)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-cream/60">
                            {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
                          </p>
                        </td>
                        <td className={ui.tableCell}>
                          <p className="text-slate-800 dark:text-cream">
                            {cart.contactName?.trim() || "—"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-cream/60">{cart.email}</p>
                        </td>
                        <td className={ui.tableCell}>
                          {phoneHref ? (
                            <a
                              href={phoneHref}
                              className="inline-flex items-center gap-2 font-medium text-brand hover:underline"
                            >
                              <PhoneIcon size={15} />
                              {cart.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className={`${ui.tableCell} font-semibold text-brand`}>
                          {formatPrice(cart.cartTotal)}
                        </td>
                        <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                          {formatDate(cart.lastActiveAt)}
                        </td>
                        <td className={ui.tableCell}>
                          <div>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${CART_TEMPERATURE_BADGE_CLASS[cart.temperature]}`}
                            >
                              {CART_TEMPERATURE_LABELS[cart.temperature]}
                            </span>
                            <p className="mt-1 max-w-[220px] text-xs text-slate-500 dark:text-cream/60">
                              {getCartTemperatureDetail(cart)}
                            </p>
                          </div>
                        </td>
                        <td className={`${ui.tableCell} text-right`}>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              className={`${ui.btnSecondary} px-3 py-1.5 text-xs`}
                              onClick={() =>
                                setExpandedUserId(isExpanded ? null : cart.userId)
                              }
                            >
                              <span className="inline-flex items-center gap-1">
                                View items
                                <ChevronDownIcon
                                  size={14}
                                  className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`${ui.btnSecondary} px-3 py-1.5 text-xs`}
                              onClick={() => setReminderCart(cart)}
                              title="Send cart reminder email"
                            >
                              <span className="inline-flex items-center gap-1">
                                <MailIcon size={14} />
                                Email
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <CartItemsAccordion cart={cart} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {reminderCart && (
        <SendCartReminderModal
          cart={reminderCart}
          onClose={() => setReminderCart(null)}
          onSent={(message) => {
            setToast(message);
            setReminderCart(null);
          }}
        />
      )}
    </AdminShell>
  );
}
