import { query } from "@/lib/db";
import { roundQuoteTotal } from "@/lib/cart-items";
import { applyDiscountPercent } from "@/lib/pricing";
import type {
  AbandonedCartAnalyticsItem,
  AbandonedCartAnalyticsMetrics,
  AbandonedCartAnalyticsResponse,
  AbandonedCartAnalyticsRow,
  CartAbandonmentTemperature,
} from "@/types/abandoned-cart-analytics";
import {
  HOT_ACTIVITY_HOURS,
  HOT_CART_TOTAL_MIN,
  WARM_ACTIVITY_DAYS,
} from "@/types/abandoned-cart-analytics";

const ACTIVE_CART_WINDOW_HOURS = 2;

type CartLineRow = {
  user_id: number;
  email: string;
  contact_name: string | null;
  company_name: string | null;
  phone: string | null;
  item_count: string;
  last_active_at: Date;
  discount_percent: string | null;
  variant_id: number;
  quantity: number;
  product_sku: string;
  product_name: string;
  color: string;
  width_in: string;
  height_in: string;
  depth_in: string;
  price: string;
};

export function classifyCartTemperature(
  cartTotal: number,
  lastActiveAt: Date,
  now = new Date()
): CartAbandonmentTemperature {
  const hoursSince =
    (now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60);
  const daysSince = hoursSince / 24;

  if (cartTotal > HOT_CART_TOTAL_MIN && hoursSince <= HOT_ACTIVITY_HOURS) {
    return "HOT";
  }

  if (daysSince > WARM_ACTIVITY_DAYS) {
    return "COLD";
  }

  return "WARM";
}

function mapLineItem(row: CartLineRow): AbandonedCartAnalyticsItem {
  return {
    productSku: row.product_sku,
    productName: row.product_name,
    color: row.color,
    quantity: row.quantity,
    widthIn: Number.parseFloat(row.width_in),
    heightIn: Number.parseFloat(row.height_in),
    depthIn: Number.parseFloat(row.depth_in),
  };
}

function buildCartRows(rows: CartLineRow[]): AbandonedCartAnalyticsRow[] {
  const grouped = new Map<
    number,
    {
      header: CartLineRow;
      items: AbandonedCartAnalyticsItem[];
      cartTotal: number;
    }
  >();

  for (const row of rows) {
    const discountPercent = Number.parseFloat(row.discount_percent ?? "0");
    const unitPrice = applyDiscountPercent(Number.parseFloat(row.price), discountPercent);
    const lineTotal = roundQuoteTotal(unitPrice * row.quantity);

    const existing = grouped.get(row.user_id);

    if (!existing) {
      grouped.set(row.user_id, {
        header: row,
        items: [mapLineItem(row)],
        cartTotal: lineTotal,
      });
      continue;
    }

    existing.items.push(mapLineItem(row));
    existing.cartTotal = roundQuoteTotal(existing.cartTotal + lineTotal);
  }

  return Array.from(grouped.values())
    .map(({ header, items, cartTotal }) => ({
      userId: header.user_id,
      email: header.email,
      companyName: header.company_name,
      contactName: header.contact_name,
      phone: header.phone,
      cartTotal,
      itemCount: Number.parseInt(header.item_count, 10),
      lastActiveAt: header.last_active_at.toISOString(),
      temperature: classifyCartTemperature(cartTotal, header.last_active_at),
      items,
    }))
    .sort(
      (left, right) =>
        new Date(right.lastActiveAt).getTime() - new Date(left.lastActiveAt).getTime()
    );
}

function buildMetrics(carts: AbandonedCartAnalyticsRow[]): AbandonedCartAnalyticsMetrics {
  const totalRecoverableRevenue = roundQuoteTotal(
    carts.reduce((sum, cart) => sum + cart.cartTotal, 0)
  );

  const hotLeadsCount = carts.filter((cart) => cart.temperature === "HOT").length;

  const skuTotals = new Map<string, number>();

  for (const cart of carts) {
    for (const item of cart.items) {
      skuTotals.set(
        item.productSku,
        (skuTotals.get(item.productSku) ?? 0) + item.quantity
      );
    }
  }

  const topAbandonedItem =
    [...skuTotals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 1)
      .map(([productSku, quantity]) => ({ productSku, quantity }))[0] ?? null;

  return {
    totalRecoverableRevenue,
    hotLeadsCount,
    topAbandonedItem,
  };
}

export async function getAbandonedCartAnalytics(): Promise<AbandonedCartAnalyticsResponse> {
  const result = await query<CartLineRow>(
    `
      WITH active_dealer_carts AS (
        SELECT
          u.id AS user_id,
          MAX(ci.updated_at) AS last_active_at,
          COUNT(ci.id)::text AS item_count
        FROM users u
        INNER JOIN cart_items ci ON ci.user_id = u.id
        INNER JOIN product_variants pv ON pv.id = ci.variant_id
        INNER JOIN products p ON p.id = pv.product_id
        INNER JOIN door_finishes df ON df.id = pv.finish_id
        WHERE u.role = 'customer'
          AND u.account_status = 'approved'
          AND pv.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND df.deleted_at IS NULL
        GROUP BY u.id
        HAVING COUNT(ci.id) > 0
          AND MAX(ci.updated_at) >= NOW() - ($1 || ' hours')::interval
      ),
      recoverable_carts AS (
        SELECT adc.user_id, adc.last_active_at, adc.item_count
        FROM active_dealer_carts adc
        WHERE NOT EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.user_id = adc.user_id
            AND o.created_at >= adc.last_active_at
        )
      )
      SELECT
        rc.user_id,
        u.email,
        u.contact_name,
        u.company_name,
        u.phone,
        rc.item_count,
        rc.last_active_at,
        ct.discount_percent,
        ci.variant_id,
        ci.quantity,
        p.sku AS product_sku,
        p.name AS product_name,
        df.name AS color,
        pv.width_in,
        pv.height_in,
        pv.depth_in,
        pv.price
      FROM recoverable_carts rc
      INNER JOIN users u ON u.id = rc.user_id
      LEFT JOIN customer_tiers ct ON ct.id = u.tier_id
      INNER JOIN cart_items ci ON ci.user_id = rc.user_id
      INNER JOIN product_variants pv ON pv.id = ci.variant_id
      INNER JOIN products p ON p.id = pv.product_id
      INNER JOIN door_finishes df ON df.id = pv.finish_id
      WHERE pv.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND df.deleted_at IS NULL
      ORDER BY rc.last_active_at DESC, rc.user_id ASC, ci.id ASC
    `,
    [String(ACTIVE_CART_WINDOW_HOURS)]
  );

  const carts = buildCartRows(result.rows);

  return {
    metrics: buildMetrics(carts),
    carts,
  };
}
