export type CartAbandonmentTemperature = "HOT" | "WARM" | "COLD";

export const HOT_CART_TOTAL_MIN = 2000;
export const HOT_ACTIVITY_HOURS = 24;
export const WARM_ACTIVITY_DAYS = 3;

export const CART_TEMPERATURE_LABELS: Record<CartAbandonmentTemperature, string> = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
};

export const CART_TEMPERATURE_BADGE_CLASS: Record<CartAbandonmentTemperature, string> = {
  HOT: "bg-orange-100 text-orange-800 ring-1 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900/50",
  WARM: "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
  COLD: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

export const CART_TEMPERATURE_GUIDE: Record<
  CartAbandonmentTemperature,
  { description: string; action: string }
> = {
  HOT: {
    description: `Cart total over $${HOT_CART_TOTAL_MIN.toLocaleString()} with dealer activity in the last ${HOT_ACTIVITY_HOURS} hours.`,
    action: "Highest priority — call the dealer first.",
  },
  WARM: {
    description: `Cart still active within the last ${WARM_ACTIVITY_DAYS} days but not hot-tier value/recency.`,
    action: "Send a reminder email or follow up this week.",
  },
  COLD: {
    description: `No meaningful cart activity for more than ${WARM_ACTIVITY_DAYS} days.`,
    action: "Lower priority — re-engage when sales bandwidth allows.",
  },
};

export const CART_TEMPERATURE_SORT_ORDER: Record<CartAbandonmentTemperature, number> = {
  HOT: 0,
  WARM: 1,
  COLD: 2,
};

export function getCartTemperatureDetail(
  cart: Pick<AbandonedCartAnalyticsRow, "temperature" | "cartTotal" | "lastActiveAt">
) {
  const elapsedMs = Date.now() - new Date(cart.lastActiveAt).getTime();
  const hoursSince = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60)));
  const daysSince = Math.max(1, Math.floor(hoursSince / 24));

  if (cart.temperature === "HOT") {
    return hoursSince < 24
      ? `$${cart.cartTotal.toLocaleString()} cart · active ${hoursSince}h ago`
      : `$${cart.cartTotal.toLocaleString()} cart · active ${daysSince}d ago`;
  }

  if (cart.temperature === "WARM") {
    return daysSince <= WARM_ACTIVITY_DAYS
      ? `Active ${daysSince === 1 ? "today" : `${daysSince}d ago`} · ${formatCartTotalShort(cart.cartTotal)}`
      : `${formatCartTotalShort(cart.cartTotal)} · warming lead`;
  }

  return `Inactive ${daysSince}+ days · ${formatCartTotalShort(cart.cartTotal)}`;
}

function formatCartTotalShort(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export type AbandonedCartAnalyticsItem = {
  productSku: string;
  productName: string;
  color: string;
  quantity: number;
  widthIn: number;
  heightIn: number;
  depthIn: number;
};

export type AbandonedCartAnalyticsRow = {
  userId: number;
  email: string;
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  cartTotal: number;
  itemCount: number;
  lastActiveAt: string;
  temperature: CartAbandonmentTemperature;
  items: AbandonedCartAnalyticsItem[];
};

export type AbandonedCartAnalyticsMetrics = {
  totalRecoverableRevenue: number;
  hotLeadsCount: number;
  topAbandonedItem: {
    productSku: string;
    quantity: number;
  } | null;
};

export type AbandonedCartAnalyticsResponse = {
  metrics: AbandonedCartAnalyticsMetrics;
  carts: AbandonedCartAnalyticsRow[];
};
