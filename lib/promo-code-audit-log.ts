import { writeAuditLog } from "@/lib/audit-log";
import { query } from "@/lib/db";
import type { PoolClient } from "pg";

type QueryExecutor = Pick<PoolClient, "query">;

async function fetchUserEmail(userId: number, client?: QueryExecutor) {
  const runQuery = client?.query.bind(client) ?? query;
  const result = await runQuery<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [userId]
  );

  return result.rows[0]?.email ?? `user #${userId}`;
}

export async function logPromoCodeIssued(
  params: {
    dealerUserId: number;
    promoCodeId: string;
    code: string;
    discountType: string;
    discountValue: number;
    expiresAt: Date;
    source: "abandoned_cart_template_3" | "manual";
    adminUserId?: number | null;
  },
  client?: QueryExecutor
) {
  const dealerEmail = await fetchUserEmail(params.dealerUserId, client);
  const expiryLabel = params.expiresAt.toLocaleDateString("en-US", {
    dateStyle: "medium",
  });
  const actor =
    params.adminUserId && params.source === "manual"
      ? await fetchUserEmail(params.adminUserId, client)
      : "System";

  await writeAuditLog(
    {
      userId: params.adminUserId ?? null,
      action: "CREATE",
      tableName: "users",
      recordId: params.dealerUserId,
      newValues: {
        event: "promo_code_issued",
        promo_code_id: params.promoCodeId,
        code: params.code,
        discount_type: params.discountType,
        discount_value: params.discountValue,
        source: params.source,
        summary:
          params.source === "manual" && params.adminUserId
            ? `${actor} created manual coupon ${params.code} (${params.discountValue}${params.discountType === "percentage" ? "%" : " USD"} off, expires ${expiryLabel}) for dealer ${dealerEmail}.`
            : `System issued promo code ${params.code} (${params.discountValue}${params.discountType === "percentage" ? "%" : " USD"} off, expires ${expiryLabel}) to dealer ${dealerEmail}.`,
      },
    },
    client
  );
}

export async function logPromoCodeApplied(params: {
  userId: number;
  code: string;
  promoDiscount: number;
  subtotal: number;
}) {
  const dealerEmail = await fetchUserEmail(params.userId);

  await writeAuditLog({
    userId: params.userId,
    action: "UPDATE",
    tableName: "users",
    recordId: params.userId,
    newValues: {
      event: "promo_code_applied",
      code: params.code,
      promo_discount: params.promoDiscount,
      subtotal: params.subtotal,
      summary: `Dealer ${dealerEmail} applied promo code ${params.code} (${params.promoDiscount.toFixed(2)} off cart).`,
    },
  });
}

export async function logPromoCodeDeleted(params: {
  adminUserId: number;
  dealerUserId: number;
  promoCodeId: string;
  code: string;
}) {
  const [adminEmail, dealerEmail] = await Promise.all([
    fetchUserEmail(params.adminUserId),
    fetchUserEmail(params.dealerUserId),
  ]);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "SOFT_DELETE",
    tableName: "users",
    recordId: params.dealerUserId,
    newValues: {
      event: "promo_code_deleted",
      promo_code_id: params.promoCodeId,
      code: params.code,
      summary: `${adminEmail} deleted unused coupon ${params.code} for dealer ${dealerEmail}.`,
    },
  });
}

export async function logPromoCodeStatusChanged(params: {
  adminUserId: number;
  dealerUserId: number;
  promoCodeId: string;
  code: string;
  isActive: boolean;
}) {
  const [adminEmail, dealerEmail] = await Promise.all([
    fetchUserEmail(params.adminUserId),
    fetchUserEmail(params.dealerUserId),
  ]);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "users",
    recordId: params.dealerUserId,
    newValues: {
      event: params.isActive ? "promo_code_reactivated" : "promo_code_deactivated",
      promo_code_id: params.promoCodeId,
      code: params.code,
      is_active: params.isActive,
      summary: params.isActive
        ? `${adminEmail} reactivated coupon ${params.code} for dealer ${dealerEmail}.`
        : `${adminEmail} deactivated coupon ${params.code} for dealer ${dealerEmail}.`,
    },
  });
}

export async function logPromoCodeRedeemed(
  params: {
    userId: number;
    orderId: number;
    code: string;
    promoDiscount: number;
  },
  client?: QueryExecutor
) {
  const dealerEmail = await fetchUserEmail(params.userId, client);

  await writeAuditLog(
    {
      userId: params.userId,
      action: "UPDATE",
      tableName: "orders",
      recordId: params.orderId,
      newValues: {
        event: "promo_code_redeemed",
        code: params.code,
        promo_discount: params.promoDiscount,
        summary: `Dealer ${dealerEmail} redeemed promo code ${params.code} on order ORD-${params.orderId}.`,
      },
    },
    client
  );
}
