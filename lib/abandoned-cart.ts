import { query } from "@/lib/db";
import { buildCartItemLabel } from "@/lib/format-dimensions";
import { roundQuoteTotal } from "@/lib/cart-items";
import { applyDiscountPercent } from "@/lib/pricing";
import { getUserDiscountPercent } from "@/lib/customer-tier";
import type {
  AbandonedCartDealerContext,
  AbandonedCartLineItem,
  AbandonedCartListItem,
  AbandonedCartSettings,
  AbandonedMailStatus,
} from "@/types/abandoned-cart";

type CartDetailRow = {
  variant_id: number;
  quantity: number;
  product_sku: string;
  color: string;
  width_in: string;
  height_in: string;
  depth_in: string;
  price: string;
  image_url: string | null;
};

type AbandonedListRow = {
  user_id: number;
  email: string;
  contact_name: string | null;
  company_name: string | null;
  item_count: string;
  last_active_at: Date;
  mail_status: AbandonedMailStatus;
  cart_total: string;
};

export async function getAbandonedCartSettings(): Promise<AbandonedCartSettings> {
  const result = await query<{
    automation_enabled: boolean;
    offer_code: string;
    offer_percent: string;
    updated_at: Date;
  }>(
    `
      SELECT automation_enabled, offer_code, offer_percent, updated_at
      FROM abandoned_cart_settings
      WHERE id = 1
    `
  );

  const row = result.rows[0];

  return {
    automationEnabled: row?.automation_enabled ?? true,
    offerCode: row?.offer_code ?? "PROJECT5",
    offerPercent: Number.parseFloat(row?.offer_percent ?? "5"),
    updatedAt: row?.updated_at.toISOString() ?? new Date().toISOString(),
  };
}

export async function updateAbandonedCartAutomationEnabled(enabled: boolean) {
  await query(
    `
      UPDATE abandoned_cart_settings
      SET automation_enabled = $1, updated_at = NOW()
      WHERE id = 1
    `,
    [enabled]
  );

  return getAbandonedCartSettings();
}

export async function resetAbandonedCartRecovery(userId: number) {
  await query(
    `
      INSERT INTO abandoned_cart_recovery (user_id, abandoned_mail_status, updated_at)
      VALUES ($1, 0, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        abandoned_mail_status = 0,
        updated_at = NOW()
      WHERE abandoned_cart_recovery.abandoned_mail_status < 3
    `,
    [userId]
  );
}

export async function markAbandonedCartRecoveryCompleted(userId: number) {
  await query(
    `
      INSERT INTO abandoned_cart_recovery (user_id, abandoned_mail_status, updated_at)
      VALUES ($1, 3, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        abandoned_mail_status = 3,
        updated_at = NOW()
    `,
    [userId]
  );
}

export async function clearAbandonedCartRecovery(userId: number) {
  await query(`DELETE FROM abandoned_cart_recovery WHERE user_id = $1`, [userId]);
}

async function loadCartDetailRows(userId: number) {
  const discountPercent = await getUserDiscountPercent(userId, "customer");

  const result = await query<CartDetailRow>(
    `
      SELECT
        ci.variant_id,
        ci.quantity,
        p.sku AS product_sku,
        df.name AS color,
        pv.width_in,
        pv.height_in,
        pv.depth_in,
        pv.price,
        COALESCE(
          (
            SELECT pi.image_url
            FROM product_images pi
            WHERE pi.product_id = p.id
              AND pi.finish_id = pv.finish_id
              AND pi.is_cover = true
            LIMIT 1
          ),
          p.image_url
        ) AS image_url
      FROM cart_items ci
      JOIN product_variants pv ON pv.id = ci.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN door_finishes df ON df.id = pv.finish_id
      WHERE ci.user_id = $1
        AND pv.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND df.deleted_at IS NULL
      ORDER BY ci.updated_at DESC, ci.id ASC
    `,
    [userId]
  );

  const items: AbandonedCartLineItem[] = result.rows.map((row) => {
    const unitPrice = applyDiscountPercent(Number.parseFloat(row.price), discountPercent);

    return {
      variantId: row.variant_id,
      name: buildCartItemLabel(
        row.product_sku,
        row.color,
        Number.parseFloat(row.width_in),
        Number.parseFloat(row.height_in),
        Number.parseFloat(row.depth_in)
      ),
      quantity: row.quantity,
      unitPrice,
      lineTotal: roundQuoteTotal(unitPrice * row.quantity),
      imageUrl: row.image_url,
    };
  });

  const cartTotal = roundQuoteTotal(items.reduce((sum, item) => sum + item.lineTotal, 0));

  return { items, cartTotal };
}

export async function loadAbandonedCartDealerContext(
  userId: number
): Promise<AbandonedCartDealerContext | null> {
  const userResult = await query<{
    email: string;
    contact_name: string | null;
    company_name: string | null;
    account_status: string;
    role: string;
  }>(
    `
      SELECT email, contact_name, company_name, account_status, role
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  const user = userResult.rows[0];

  if (!user || user.role !== "customer" || user.account_status !== "approved") {
    return null;
  }

  const activityResult = await query<{ last_active_at: Date }>(
    `
      SELECT MAX(ci.updated_at) AS last_active_at
      FROM cart_items ci
      WHERE ci.user_id = $1
    `,
    [userId]
  );

  const activity = activityResult.rows[0];

  if (!activity?.last_active_at) {
    return null;
  }

  const statusResult = await query<{ abandoned_mail_status: AbandonedMailStatus | null }>(
    `
      SELECT abandoned_mail_status
      FROM abandoned_cart_recovery
      WHERE user_id = $1
    `,
    [userId]
  );

  const mailStatus = statusResult.rows[0]?.abandoned_mail_status ?? 0;

  const { items, cartTotal } = await loadCartDetailRows(userId);

  if (items.length === 0) {
    return null;
  }

  return {
    userId,
    email: user.email,
    contactName: user.contact_name,
    companyName: user.company_name,
    lastCartActivityAt: activity.last_active_at.toISOString(),
    mailStatus,
    items,
    cartTotal,
  };
}

export async function listAbandonedCartsForAdmin(): Promise<AbandonedCartListItem[]> {
  const result = await query<AbandonedListRow>(
    `
      SELECT
        u.id AS user_id,
        u.email,
        u.contact_name,
        u.company_name,
        COUNT(ci.id)::text AS item_count,
        MAX(ci.updated_at) AS last_active_at,
        COALESCE(acr.abandoned_mail_status, 0)::smallint AS mail_status,
        COALESCE(SUM(pv.price * ci.quantity), 0)::text AS cart_total
      FROM users u
      JOIN cart_items ci ON ci.user_id = u.id
      JOIN product_variants pv ON pv.id = ci.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN door_finishes df ON df.id = pv.finish_id
      LEFT JOIN abandoned_cart_recovery acr ON acr.user_id = u.id
      WHERE u.role = 'customer'
        AND u.account_status = 'approved'
        AND pv.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND df.deleted_at IS NULL
      GROUP BY u.id, u.email, u.contact_name, u.company_name, acr.abandoned_mail_status
      HAVING COUNT(ci.id) > 0
      ORDER BY MAX(ci.updated_at) DESC
    `
  );

  const rows = await Promise.all(
    result.rows.map(async (row) => {
      const details = await loadCartDetailRows(row.user_id);

      return {
        userId: row.user_id,
        email: row.email,
        contactName: row.contact_name,
        companyName: row.company_name,
        cartTotal: details.cartTotal,
        itemCount: Number.parseInt(row.item_count, 10),
        lastActiveAt: row.last_active_at.toISOString(),
        mailStatus: row.mail_status,
      } satisfies AbandonedCartListItem;
    })
  );

  return rows;
}

export async function setAbandonedMailStatus(userId: number, status: AbandonedMailStatus) {
  await query(
    `
      INSERT INTO abandoned_cart_recovery (user_id, abandoned_mail_status, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        abandoned_mail_status = EXCLUDED.abandoned_mail_status,
        updated_at = NOW()
    `,
    [userId, status]
  );
}

export async function userOrderedSinceCartActivity(userId: number, lastCartActivityAt: Date) {
  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM orders o
        WHERE o.user_id = $1
          AND o.created_at >= $2
      ) AS exists
    `,
    [userId, lastCartActivityAt]
  );

  return result.rows[0]?.exists ?? false;
}

export async function listAbandonedCartRecoveryCandidates() {
  const result = await query<{
    user_id: number;
    last_active_at: Date;
    mail_status: AbandonedMailStatus;
    group_tag: string;
  }>(
    `
      SELECT
        u.id AS user_id,
        MAX(ci.updated_at) AS last_active_at,
        COALESCE(acr.abandoned_mail_status, 0)::smallint AS mail_status,
        u.group_tag
      FROM users u
      JOIN cart_items ci ON ci.user_id = u.id
      LEFT JOIN abandoned_cart_recovery acr ON acr.user_id = u.id
      WHERE u.role = 'customer'
        AND u.account_status = 'approved'
      GROUP BY u.id, acr.abandoned_mail_status, u.group_tag
      HAVING COUNT(ci.id) > 0
        AND COALESCE(acr.abandoned_mail_status, 0) < 3
    `
  );

  return result.rows;
}
