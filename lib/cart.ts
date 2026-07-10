import { query } from "@/lib/db";
import {
  clearAbandonedCartRecovery,
  resetAbandonedCartRecovery,
} from "@/lib/abandoned-cart";
import { clearCartAppliedPromo } from "@/lib/cart-applied-promo";
import { buildCartItemLabel } from "@/lib/format-dimensions";
import { applyDiscountPercent } from "@/lib/pricing";
import type { OrderCartItem } from "@/types/catalog";

export const CART_MAX_AGE_DAYS = 30;

type CartItemRow = {
  variant_id: number;
  quantity: number;
  product_name: string;
  product_sku: string;
  color: string;
  width_in: string;
  height_in: string;
  depth_in: string;
  price: string;
};

function buildCartItemLabelFromRow(row: CartItemRow) {
  const width = Number.parseFloat(row.width_in);
  const height = Number.parseFloat(row.height_in);
  const depth = Number.parseFloat(row.depth_in);

  return buildCartItemLabel(row.product_sku, row.color, width, height, depth);
}

export function mapCartItemRow(row: CartItemRow, discountPercent: number): OrderCartItem {
  const price = applyDiscountPercent(Number.parseFloat(row.price), discountPercent);

  return {
    id: String(row.variant_id),
    name: buildCartItemLabelFromRow(row),
    width: row.width_in,
    height: row.height_in,
    depth: row.depth_in,
    price,
    quantity: row.quantity,
  };
}

export async function purgeExpiredCartItems(userId: number) {
  await query(
    `
      DELETE FROM cart_items
      WHERE user_id = $1
        AND updated_at < NOW() - ($2 || ' days')::interval
    `,
    [userId, String(CART_MAX_AGE_DAYS)]
  );
}

export async function loadUserCartItems(userId: number, discountPercent: number) {
  await purgeExpiredCartItems(userId);

  const result = await query<CartItemRow>(
    `
      SELECT
        ci.variant_id,
        ci.quantity,
        p.name AS product_name,
        p.sku AS product_sku,
        df.name AS color,
        pv.width_in,
        pv.height_in,
        pv.depth_in,
        pv.price
      FROM cart_items ci
      JOIN product_variants pv ON pv.id = ci.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN door_finishes df ON df.id = pv.finish_id
      WHERE ci.user_id = $1
      ORDER BY ci.updated_at DESC, ci.id ASC
    `,
    [userId]
  );

  return result.rows.map((row) => mapCartItemRow(row, discountPercent));
}

export async function replaceUserCartItems(
  userId: number,
  items: Array<{ variantId: number; quantity: number }>
) {
  await purgeExpiredCartItems(userId);

  const normalized = items.filter((item) => item.quantity > 0);

  if (normalized.length === 0) {
    await query("DELETE FROM cart_items WHERE user_id = $1", [userId]);
    await clearAbandonedCartRecovery(userId);
    await clearCartAppliedPromo(userId);
    return;
  }

  const variantIds = normalized.map((item) => item.variantId);

  await query(
    `
      DELETE FROM cart_items
      WHERE user_id = $1
        AND variant_id <> ALL($2::int[])
    `,
    [userId, variantIds]
  );

  for (const item of normalized) {
    await query(
      `
        INSERT INTO cart_items (user_id, variant_id, quantity, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, variant_id)
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          updated_at = NOW()
      `,
      [userId, item.variantId, item.quantity]
    );
  }

  await resetAbandonedCartRecovery(userId);
}

export async function clearUserCart(userId: number) {
  await query("DELETE FROM cart_items WHERE user_id = $1", [userId]);
  await clearAbandonedCartRecovery(userId);
  await clearCartAppliedPromo(userId);
}

export async function mergeGuestCartItems(
  userId: number,
  items: Array<{ variantId: number; quantity: number }>
) {
  if (items.length === 0) {
    return;
  }

  for (const item of items) {
    if (item.quantity <= 0) {
      continue;
    }

    await query(
      `
        INSERT INTO cart_items (user_id, variant_id, quantity, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, variant_id)
        DO UPDATE SET
          quantity = cart_items.quantity + EXCLUDED.quantity,
          updated_at = NOW()
      `,
      [userId, item.variantId, item.quantity]
    );
  }

  await resetAbandonedCartRecovery(userId);
}
