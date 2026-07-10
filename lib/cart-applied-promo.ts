import { query } from "@/lib/db";

export type CartAppliedPromoRow = {
  user_id: number;
  promo_code_id: string;
  code: string;
  promo_discount: string;
  subtotal_at_apply: string;
  applied_at: Date;
};

export type CartAppliedPromo = {
  userId: number;
  promoCodeId: string;
  code: string;
  promoDiscount: number;
  subtotalAtApply: number;
  appliedAt: string;
};

function mapCartAppliedPromo(row: CartAppliedPromoRow): CartAppliedPromo {
  return {
    userId: row.user_id,
    promoCodeId: row.promo_code_id,
    code: row.code,
    promoDiscount: Number.parseFloat(row.promo_discount),
    subtotalAtApply: Number.parseFloat(row.subtotal_at_apply),
    appliedAt: row.applied_at.toISOString(),
  };
}

export async function getCartAppliedPromo(userId: number) {
  const result = await query<CartAppliedPromoRow>(
    `
      SELECT user_id, promo_code_id, code, promo_discount, subtotal_at_apply, applied_at
      FROM cart_applied_promos
      WHERE user_id = $1
    `,
    [userId]
  );

  const row = result.rows[0];
  return row ? mapCartAppliedPromo(row) : null;
}

export async function isPromoAlreadyAppliedToCart(userId: number, code: string) {
  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS(
        SELECT 1
        FROM cart_applied_promos
        WHERE user_id = $1
          AND UPPER(code) = UPPER($2)
      ) AS exists
    `,
    [userId, code]
  );

  return result.rows[0]?.exists === true;
}

export async function saveCartAppliedPromo(params: {
  userId: number;
  promoCodeId: string;
  code: string;
  promoDiscount: number;
  subtotal: number;
}) {
  await query(
    `
      INSERT INTO cart_applied_promos (
        user_id,
        promo_code_id,
        code,
        promo_discount,
        subtotal_at_apply
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        promo_code_id = EXCLUDED.promo_code_id,
        code = EXCLUDED.code,
        promo_discount = EXCLUDED.promo_discount,
        subtotal_at_apply = EXCLUDED.subtotal_at_apply,
        applied_at = NOW()
    `,
    [
      params.userId,
      params.promoCodeId,
      params.code,
      params.promoDiscount,
      params.subtotal,
    ]
  );
}

export async function clearCartAppliedPromo(userId: number) {
  await query(`DELETE FROM cart_applied_promos WHERE user_id = $1`, [userId]);
}
