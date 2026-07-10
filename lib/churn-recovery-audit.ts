import { writeAuditLog } from "@/lib/audit-log";
import { query } from "@/lib/db";

async function fetchUserLabel(userId: number) {
  const result = await query<{
    email: string;
    company_name: string | null;
    contact_name: string | null;
  }>(
    `
      SELECT email, company_name, contact_name
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return `user #${userId}`;
  }

  return row.company_name?.trim() || row.contact_name?.trim() || row.email;
}

export async function logChurnRecoveryCouponIssued(params: {
  adminUserId: number;
  dealerUserId: number;
  promoCodeId: string;
  code: string;
  discountPercent: number;
  expiryDays: number;
  lifetimeValue: number;
}) {
  const [adminLabel, dealerLabel] = await Promise.all([
    fetchUserLabel(params.adminUserId),
    fetchUserLabel(params.dealerUserId),
  ]);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "users",
    recordId: params.dealerUserId,
    newValues: {
      event: "churn_recovery_coupon_issued",
      promo_code_id: params.promoCodeId,
      code: params.code,
      discount_percent: params.discountPercent,
      expiry_days: params.expiryDays,
      dealer_lifetime_value: params.lifetimeValue,
      summary: `${adminLabel} issued churn recovery coupon ${params.code} (${params.discountPercent}% off, ${params.expiryDays} days) for VIP dealer ${dealerLabel} (LTV $${params.lifetimeValue.toLocaleString()}).`,
    },
  });
}
