"use client";

import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/Icon";
import { useCartRemoveConfirm } from "@/components/cart/CartRemoveConfirmProvider";
import { QuoteItemPriceChangeHint } from "@/components/quotes/QuotePriceChangeBanner";
import { CART_UNAVAILABLE_MESSAGE } from "@/lib/cart-validation.constants";
import { getCartItemDimensionsLabel, stripCartItemDimensions } from "@/lib/format-dimensions";
import { formatPrice } from "@/lib/order-display";
import { formatTexasTaxRatePercent } from "@/lib/sales-tax";
import { ui } from "@/lib/ui-classes";
import type { ServerCartPricingResult } from "@/lib/server-cart-pricing";
import type { AppliedPromoSummary } from "@/types/promo-code";
import { useCartStore } from "@/store/useCartStore";

type CartItemsListProps = {
  compact?: boolean;
};

export function CartItemsList({ compact = false }: CartItemsListProps) {
  const items = useCartStore((state) => state.items);
  const availability = useCartStore((state) => state.availability);
  const quotePriceChangeNotice = useCartStore((state) => state.quotePriceChangeNotice);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const { requestRemoveItem } = useCartRemoveConfirm();

  const changedByVariantId = new Map(
    (quotePriceChangeNotice?.changedItems ?? []).map((item) => [item.variantId, item])
  );

  if (items.length === 0) {
    return <p className={ui.bodyMuted}>Your cart is empty.</p>;
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {items.map((item) => {
        const dimensionsLabel = getCartItemDimensionsLabel(item);
        const isUnavailable = availability[item.id] === false;
        const priceChange = changedByVariantId.get(item.id);

        return (
          <div
            key={item.id}
            className={`rounded-2xl border shadow-sm ${
              isUnavailable
                ? "border-red-300 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/25"
                : "border-slate-200/60 bg-white dark:border-zinc-700/50 dark:bg-navy"
            } ${compact ? "p-3" : "p-4"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-cream">
                  {stripCartItemDimensions(item.name)}
                </p>
                {dimensionsLabel && (
                  <p className={`mt-1 text-xs ${ui.bodyMuted}`}>{dimensionsLabel}</p>
                )}
                {priceChange && (
                  <QuoteItemPriceChangeHint
                    oldPrice={priceChange.oldPrice}
                    newPrice={priceChange.newPrice}
                    outOfStock={priceChange.outOfStock}
                  />
                )}
                {isUnavailable && (
                  <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                    {CART_UNAVAILABLE_MESSAGE}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  requestRemoveItem({
                    id: item.id,
                    name: stripCartItemDimensions(item.name),
                  })
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-red-600 dark:text-cream/60 dark:hover:text-red-400"
              >
                <TrashIcon size={13} />
                Remove
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-600 dark:bg-navy-hover">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-white dark:text-cream dark:hover:bg-navy"
                  aria-label="Decrease quantity"
                >
                  <MinusIcon size={14} />
                </button>
                <span className="min-w-8 select-none text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-cream">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-white dark:text-cream dark:hover:bg-navy"
                  aria-label="Increase quantity"
                >
                  <PlusIcon size={14} />
                </button>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-950 dark:text-brand">
                  {formatPrice(item.price * item.quantity)}
                </p>
                {!compact && (
                  <p className={`text-xs ${ui.bodyMuted}`}>{formatPrice(item.price)} each</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type CartTotalsCartProps = {
  mode: "cart";
  appliedPromo?: AppliedPromoSummary | null;
};

type CartTotalsCheckoutProps = {
  mode: "checkout";
  pricing: ServerCartPricingResult | null;
  isLoading?: boolean;
  hasShippingSelection?: boolean;
};

type CartTotalsProps = CartTotalsCartProps | CartTotalsCheckoutProps;

function DeferredValue({ label }: { label: string }) {
  return <span className="font-medium text-slate-400 dark:text-cream/45">{label}</span>;
}

export function CartTotals(props: CartTotalsProps) {
  const totalItems = useCartStore((state) => state.totalItems());
  const cartSubtotal = useCartStore((state) => state.totalPrice());

  if (props.mode === "cart") {
    const appliedPromo = props.appliedPromo;
    const subtotal = appliedPromo?.subtotal ?? cartSubtotal;
    const promoDiscount = appliedPromo?.promoDiscount ?? 0;

    return (
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-zinc-700/50 dark:bg-navy-hover/40">
        <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
          <span>Items</span>
          <span className="font-semibold text-slate-900 dark:text-cream">{totalItems}</span>
        </div>

        <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
          <span>Subtotal</span>
          <span className="font-semibold text-slate-900 dark:text-cream">
            {formatPrice(subtotal)}
          </span>
        </div>

        {appliedPromo && promoDiscount > 0 && (
          <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-300">
            <span>Promo ({appliedPromo.code})</span>
            <span className="font-semibold">-{formatPrice(promoDiscount)}</span>
          </div>
        )}

        <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
          <span>Shipping & Delivery</span>
          <DeferredValue label="Calculated at checkout" />
        </div>

        <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
          <span>Estimated tax</span>
          <DeferredValue label="Calculated at checkout" />
        </div>

        <div className="border-t border-slate-200/80 pt-3 dark:border-zinc-700/50">
          <p className={`text-xs leading-relaxed ${ui.bodyMuted}`}>
            Delivery rates are confirmed when you choose a shipping address at checkout.
          </p>
        </div>
      </div>
    );
  }

  const { pricing, isLoading = false, hasShippingSelection = false } = props;

  if (!pricing || !hasShippingSelection) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-zinc-700/50 dark:bg-navy-hover/40">
        <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
          <span>Items</span>
          <span className="font-semibold text-slate-900 dark:text-cream">{totalItems}</span>
        </div>
        <p className={`text-sm ${ui.bodyMuted}`}>
          {isLoading
            ? "Calculating shipping and totals..."
            : "Select a shipping address to see delivery charges."}
        </p>
      </div>
    );
  }

  const taxPercentLabel = formatTexasTaxRatePercent(pricing.taxRate);
  const shippingLabel = pricing.shippingIsFree
    ? "$0.00 (Free)"
    : formatPrice(pricing.shippingAmount);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-zinc-700/50 dark:bg-navy-hover/40">
      <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
        <span>Items</span>
        <span className="font-semibold text-slate-900 dark:text-cream">{totalItems}</span>
      </div>

      <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
        <span>Subtotal</span>
        <span className="font-semibold text-slate-900 dark:text-cream">
          {formatPrice(pricing.subtotal)}
        </span>
      </div>

      {pricing.promoDiscount > 0 && pricing.promoCode && (
        <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-300">
          <span>Promo ({pricing.promoCode})</span>
          <span className="font-semibold">-{formatPrice(pricing.promoDiscount)}</span>
        </div>
      )}

      <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
        <span>
          Shipping & Delivery
          {pricing.shippingZoneName ? ` (${pricing.shippingZoneName})` : ""}
        </span>
        <span className="font-semibold text-slate-900 dark:text-cream">{shippingLabel}</span>
      </div>

      {pricing.shippingNotice && (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {pricing.shippingNotice}
        </p>
      )}

      {pricing.taxExempt ? (
        <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
          <span>Estimated Tax</span>
          <span className="font-semibold text-slate-900 dark:text-cream">$0.00 (Tax Exempt)</span>
        </div>
      ) : pricing.taxAmount > 0 ? (
        <div className={`flex items-center justify-between ${ui.bodyMuted}`}>
          <span>Estimated Tax ({taxPercentLabel}%)</span>
          <span className="font-semibold text-slate-900 dark:text-cream">
            {formatPrice(pricing.taxAmount)}
          </span>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-slate-200/80 pt-3 dark:border-zinc-700/50">
        <span className="text-sm font-medium text-slate-600 dark:text-cream/75">Final Total</span>
        <span className="text-2xl font-bold tracking-tight text-slate-950 dark:text-cream">
          {formatPrice(pricing.totalAmount)}
        </span>
      </div>
    </div>
  );
}
