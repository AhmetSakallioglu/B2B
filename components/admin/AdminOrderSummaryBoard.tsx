import type { ReactNode } from "react";
import { TagIcon } from "@/components/ui/Icon";
import { formatPrice } from "@/lib/order-display";
import { formatTexasTaxRatePercent } from "@/lib/sales-tax";
import type { OrderPricingSummary } from "@/types/orders";

type AdminOrderSummaryBoardProps = {
  pricing: OrderPricingSummary;
  variant?: "sidebar" | "card";
};

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function SummaryLine({
  label,
  detail,
  amount,
  amountTone = "neutral",
  icon,
}: {
  label: string;
  detail?: string;
  amount: string;
  amountTone?: "neutral" | "discount" | "coupon";
  icon?: ReactNode;
}) {
  const amountClass =
    amountTone === "discount"
      ? "text-amber-700 dark:text-amber-300"
      : amountTone === "coupon"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-slate-800 dark:text-cream";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-medium text-slate-800 dark:text-cream">{label}</p>
        </div>
        {detail && (
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-cream/55">{detail}</p>
        )}
      </div>
      <p className={`pt-0.5 text-right text-sm font-semibold tabular-nums tracking-tight ${amountClass}`}>
        {amount}
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "savings" | "total";
}) {
  const toneClass =
    tone === "savings"
      ? "border-amber-200/80 bg-amber-50/80 dark:border-amber-900/30 dark:bg-amber-950/20"
      : tone === "total"
        ? "border-slate-800 bg-slate-950 text-white dark:border-zinc-600 dark:bg-slate-900"
        : "border-slate-200/80 bg-white dark:border-zinc-700/50 dark:bg-navy";

  const labelClass =
    tone === "total" ? "text-slate-400" : "text-slate-500 dark:text-cream/55";
  const valueClass =
    tone === "total"
      ? "text-white"
      : tone === "savings"
        ? "text-amber-700 dark:text-amber-300"
        : "text-slate-900 dark:text-cream";

  return (
    <div className={`rounded-xl border px-4 py-3.5 ${toneClass}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${labelClass}`}>
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold tabular-nums tracking-tight ${valueClass}`}>{value}</p>
      <p className={`mt-1 text-xs ${tone === "total" ? "text-slate-400" : "text-slate-500 dark:text-cream/55"}`}>
        {hint}
      </p>
    </div>
  );
}

export function AdminOrderSummaryBoard({
  pricing,
  variant = "card",
}: AdminOrderSummaryBoardProps) {
  const isSidebar = variant === "sidebar";
  const hasCoupon =
    Boolean(pricing.appliedCouponCode) && pricing.couponDiscountAmount > 0;
  const tierPercentLabel = formatPercent(pricing.tierDiscountPercent) ?? "0";
  const couponPercentLabel = formatPercent(pricing.couponDiscountPercent);
  const totalSavings = pricing.tierDiscountAmount + pricing.couponDiscountAmount;
  const taxPercentLabel = formatTexasTaxRatePercent(pricing.taxRate);
  const savingsPercent =
    pricing.msrpSubtotal > 0
      ? Math.round((totalSavings / pricing.msrpSubtotal) * 100)
      : 0;

  const shellClass = isSidebar
    ? "flex h-full min-h-full w-full flex-col"
    : "w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_30px_-18px_rgba(15,23,42,0.35)] dark:border-zinc-700/60 dark:bg-navy";

  return (
    <aside className={shellClass}>
      <div
        className={
          isSidebar
            ? "border-b border-slate-200/80 px-6 py-5 dark:border-zinc-700/50"
            : "border-b border-slate-100 bg-linear-to-r from-slate-50 to-white px-5 py-4 dark:border-zinc-700/50 dark:from-navy-hover/40 dark:to-navy"
        }
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-cream/50">
          Pricing breakdown
        </p>
        <p className="mt-1.5 text-base font-semibold text-slate-900 dark:text-cream">
          Invoice summary
        </p>
        {!isSidebar && (
          <p className="mt-1 text-sm text-slate-600 dark:text-cream/70">
            MSRP through final dealer total
          </p>
        )}
      </div>

      {isSidebar && (
        <div className="grid gap-3 px-6 py-5">
          <StatTile
            label="MSRP subtotal"
            value={formatPrice(pricing.msrpSubtotal)}
            hint="List price before discounts"
          />
          <StatTile
            label="Total savings"
            value={`−${formatPrice(totalSavings)}`}
            hint={`${savingsPercent}% below MSRP`}
            tone="savings"
          />
          <StatTile
            label="Final total"
            value={formatPrice(pricing.totalAmount)}
            hint="Charged to dealer"
            tone="total"
          />
        </div>
      )}

      <div
        className={`flex flex-1 flex-col ${
          isSidebar ? "px-6 pb-6" : "divide-y divide-slate-100 dark:divide-zinc-700/50"
        }`}
      >
        <div className={isSidebar ? "rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-navy" : "px-5"}>
          {!isSidebar && (
            <div className="divide-y divide-slate-100 dark:divide-zinc-700/50">
              <SummaryLine
                label="MSRP subtotal"
                detail="List price before contractor discounts"
                amount={formatPrice(pricing.msrpSubtotal)}
              />
            </div>
          )}

          <div className={isSidebar ? "space-y-0 divide-y divide-slate-100 dark:divide-zinc-700/50" : ""}>
            {isSidebar && (
              <p className="pb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-cream/50">
                Adjustments
              </p>
            )}

            <SummaryLine
              label="Tier discount"
              detail={`${pricing.tierName} · ${tierPercentLabel}% off MSRP`}
              amount={`−${formatPrice(pricing.tierDiscountAmount)}`}
              amountTone="discount"
            />

            {hasCoupon ? (
              <SummaryLine
                label="Coupon savings"
                detail={`Code ${pricing.appliedCouponCode}${
                  couponPercentLabel ? ` · ${couponPercentLabel}%` : ""
                }`}
                amount={`−${formatPrice(pricing.couponDiscountAmount)}`}
                amountTone="coupon"
                icon={
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <TagIcon size={13} />
                  </span>
                }
              />
            ) : (
              isSidebar && (
                <p className="py-3 text-xs text-slate-500 dark:text-cream/55">
                  No coupon applied on this order.
                </p>
              )
            )}

            <SummaryLine
              label="Taxable subtotal"
              detail="Merchandise after tier and coupon discounts"
              amount={formatPrice(pricing.taxableSubtotal)}
            />

            {pricing.taxAmount > 0 ? (
              <SummaryLine
                label={`Texas Sales Tax (${taxPercentLabel}%)`}
                detail="Collected at checkout"
                amount={formatPrice(pricing.taxAmount)}
              />
            ) : (
              isSidebar && (
                <p className="py-3 text-xs text-slate-500 dark:text-cream/55">
                  No sales tax on this order.
                </p>
              )
            )}

            <SummaryLine
              label="Shipping & Delivery"
              detail={
                pricing.shippingZoneName
                  ? `${pricing.shippingZoneName}${pricing.shippingPostalCode ? ` · ZIP ${pricing.shippingPostalCode}` : ""}`
                  : pricing.shippingIsOutOfZone
                    ? "Out-of-zone default rate"
                    : "Delivery charge"
              }
              amount={
                pricing.shippingIsFree
                  ? "$0.00 (Free)"
                  : formatPrice(pricing.shippingAmount)
              }
            />
          </div>
        </div>

        {!isSidebar && (
          <div className="space-y-3 px-5 py-4">
            {totalSavings > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs dark:bg-navy-hover/50">
                <span className="font-medium text-slate-500 dark:text-cream/60">Total savings</span>
                <span className="font-semibold tabular-nums text-slate-700 dark:text-cream">
                  −{formatPrice(totalSavings)}
                </span>
              </div>
            )}

            <div className="rounded-xl border border-slate-200/80 bg-slate-950 px-4 py-4 text-white dark:border-zinc-600 dark:bg-slate-900">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Final order total
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Amount charged to dealer</p>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {formatPrice(pricing.totalAmount)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
