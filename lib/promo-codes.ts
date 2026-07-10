import { randomInt } from "crypto";
import { query } from "@/lib/db";
import { roundQuoteTotal } from "@/lib/cart-items";
import { roundCurrency } from "@/lib/pricing";
import { sanitizePlainText } from "@/lib/input-sanitization";
import {
  logPromoCodeIssued,
  logPromoCodeApplied,
  logPromoCodeRedeemed,
} from "@/lib/promo-code-audit-log";
import { getPromoExpiryDays } from "@/lib/automation-settings";
import {
  PROMO_CODE_INVALID_MESSAGE,
  PROMO_DEFAULT_DISCOUNT_PERCENT,
  type PromoCode,
  type PromoCodeRecord,
  type PromoCreationType,
  type PromoDiscountType,
} from "@/types/promo-code";
import type { PoolClient } from "pg";

type QueryExecutor = Pick<PoolClient, "query">;

const PROMO_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_GENERATION_ATTEMPTS = 8;

const PROMO_CODE_SELECT = `
  id,
  code,
  discount_type,
  discount_value,
  user_id,
  creation_type,
  is_used,
  is_active,
  expires_at,
  used_at,
  order_id,
  created_at
`;

const PROMO_CODE_JOIN_SELECT = `
  pc.id,
  pc.code,
  pc.discount_type,
  pc.discount_value,
  pc.user_id,
  pc.creation_type,
  pc.is_used,
  pc.is_active,
  pc.expires_at,
  pc.used_at,
  pc.order_id,
  pc.created_at
`;

function mapPromoCodeRow(row: PromoCodeRecord): PromoCode {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number.parseFloat(row.discount_value),
    userId: row.user_id,
    creationType: row.creation_type ?? "AUTOMATIC",
    isUsed: row.is_used,
    isActive: row.is_active ?? true,
    expiresAt: row.expires_at.toISOString(),
    usedAt: row.used_at?.toISOString() ?? null,
    orderId: row.order_id,
    createdAt: row.created_at.toISOString(),
  };
}

function randomPromoSegment(length: number) {
  let segment = "";

  for (let index = 0; index < length; index += 1) {
    segment += PROMO_ALPHABET[randomInt(PROMO_ALPHABET.length)]!;
  }

  return segment;
}

export function generatePromoCodeValue() {
  return `CAB-${randomPromoSegment(4)}-${randomPromoSegment(2)}`;
}

export function normalizePromoCodeInput(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = sanitizePlainText(value.toUpperCase(), 32, true);

  if (!cleaned || !/^[A-Z0-9-]+$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export function calculatePromoDiscount(
  subtotal: number,
  discountType: PromoDiscountType,
  discountValue: number
) {
  if (subtotal <= 0) {
    return 0;
  }

  if (discountType === "percentage") {
    return roundCurrency(Math.min(subtotal, subtotal * (discountValue / 100)));
  }

  return roundCurrency(Math.min(subtotal, discountValue));
}

export async function createPromoCodeForUser(
  params: {
    userId: number;
    discountType?: PromoDiscountType;
    discountValue?: number;
    expiryDays?: number;
    creationType?: PromoCreationType;
    source?: "abandoned_cart_template_3" | "manual";
    adminUserId?: number | null;
  },
  client?: QueryExecutor
) {
  const runQuery = client?.query.bind(client) ?? query;
  const discountType = params.discountType ?? "percentage";
  const discountValue = params.discountValue ?? PROMO_DEFAULT_DISCOUNT_PERCENT;
  const expiryDays = params.expiryDays ?? (await getPromoExpiryDays());
  const creationType = params.creationType ?? "AUTOMATIC";
  const source = params.source ?? "abandoned_cart_template_3";

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generatePromoCodeValue();

    try {
      const result = await runQuery<PromoCodeRecord>(
        `
          INSERT INTO promo_codes (
            code,
            discount_type,
            discount_value,
            user_id,
            creation_type,
            expires_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' days')::interval)
          RETURNING
            ${PROMO_CODE_SELECT}
        `,
        [code, discountType, discountValue, params.userId, creationType, String(expiryDays)]
      );

      const row = result.rows[0];

      if (!row) {
        throw new Error("Failed to create promo code");
      }

      const promo = mapPromoCodeRow(row);

      await logPromoCodeIssued(
        {
          dealerUserId: params.userId,
          promoCodeId: promo.id,
          code: promo.code,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          expiresAt: row.expires_at,
          source,
          adminUserId: params.adminUserId,
        },
        client
      );

      return promo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("promo_codes_code_key") || message.includes("duplicate key")) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Failed to generate a unique promo code");
}

export async function fetchPromoCodeByCode(code: string, client?: QueryExecutor) {
  const runQuery = client?.query.bind(client) ?? query;

  const result = await runQuery<PromoCodeRecord>(
    `
      SELECT ${PROMO_CODE_SELECT}
      FROM promo_codes
      WHERE UPPER(code) = UPPER($1)
      LIMIT 1
    `,
    [code]
  );

  const row = result.rows[0];
  return row ? mapPromoCodeRow(row) : null;
}

export type PromoCodeValidationResult =
  | { ok: true; promo: PromoCode }
  | { ok: false; message: string; status: 403 };

export function validatePromoCodeForUser(promo: PromoCode | null, userId: number): PromoCodeValidationResult {
  if (
    !promo ||
    !promo.isActive ||
    promo.isUsed ||
    new Date(promo.expiresAt).getTime() <= Date.now()
  ) {
    return {
      ok: false,
      message: PROMO_CODE_INVALID_MESSAGE,
      status: 403,
    };
  }

  if (promo.userId !== userId) {
    return {
      ok: false,
      message: PROMO_CODE_INVALID_MESSAGE,
      status: 403,
    };
  }

  return { ok: true, promo };
}

export async function validatePromoCodeForUserByCode(code: string, userId: number) {
  const promo = await fetchPromoCodeByCode(code);
  return validatePromoCodeForUser(promo, userId);
}

export async function markPromoCodeUsed(
  params: {
    promoCodeId: string;
    userId: number;
    orderId: number;
    code: string;
    promoDiscount: number;
  },
  client: QueryExecutor
) {
  const result = await client.query<{ id: string }>(
    `
      UPDATE promo_codes
      SET
        is_used = true,
        used_at = NOW(),
        order_id = $3
      WHERE id = $1
        AND user_id = $2
        AND is_used = false
        AND is_active = true
        AND expires_at > NOW()
      RETURNING id
    `,
    [params.promoCodeId, params.userId, params.orderId]
  );

  if (!result.rows[0]) {
    throw new Error(PROMO_CODE_INVALID_MESSAGE);
  }

  await logPromoCodeRedeemed(
    {
      userId: params.userId,
      orderId: params.orderId,
      code: params.code,
      promoDiscount: params.promoDiscount,
    },
    client
  );
}

export async function recordPromoCodeApplied(params: {
  userId: number;
  code: string;
  promoDiscount: number;
  subtotal: number;
}) {
  await logPromoCodeApplied(params);
}

export { formatPromoExpiryForEmail, formatPromoExpiryShort } from "@/lib/promo-display";

type PromoCodeListRow = PromoCodeRecord & {
  user_email: string;
  company_name: string | null;
};

export async function getPromoCodeById(promoCodeId: string) {
  const result = await query<PromoCodeListRow>(
    `
      SELECT
        ${PROMO_CODE_JOIN_SELECT},
        u.email AS user_email,
        u.company_name
      FROM promo_codes pc
      JOIN users u ON u.id = pc.user_id
      WHERE pc.id = $1
      LIMIT 1
    `,
    [promoCodeId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapPromoCodeRow(row),
    userEmail: row.user_email,
    companyName: row.company_name,
  };
}

export async function setPromoCodeActive(promoCodeId: string, isActive: boolean) {
  const result = await query<PromoCodeRecord>(
    `
      UPDATE promo_codes
      SET is_active = $2
      WHERE id = $1
      RETURNING ${PROMO_CODE_SELECT}
    `,
    [promoCodeId, isActive]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Promo code not found");
  }

  return mapPromoCodeRow(row);
}

export async function deletePromoCodeRecord(promoCodeId: string) {
  const existing = await getPromoCodeById(promoCodeId);

  if (!existing) {
    throw new Error("Promo code not found");
  }

  if (existing.isUsed) {
    throw new Error("Used coupons cannot be deleted");
  }

  await query(`DELETE FROM promo_codes WHERE id = $1`, [promoCodeId]);

  return existing;
}

export async function listRecentPromoCodes(limit = 50) {
  const result = await query<PromoCodeListRow>(
    `
      SELECT
        ${PROMO_CODE_JOIN_SELECT},
        u.email AS user_email,
        u.company_name
      FROM promo_codes pc
      JOIN users u ON u.id = pc.user_id
      ORDER BY pc.created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row) => ({
    ...mapPromoCodeRow(row),
    userEmail: row.user_email,
    companyName: row.company_name,
  }));
}
