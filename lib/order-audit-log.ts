import { writeAuditLog } from "@/lib/audit-log";
import { query } from "@/lib/db";
import { formatPrice } from "@/lib/order-display";

async function fetchAdminEmail(adminUserId: number) {
  const result = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [adminUserId]
  );

  return result.rows[0]?.email ?? `admin #${adminUserId}`;
}

export async function logCustomerOrderCreated(params: {
  userId: number;
  orderId: number;
  totalPrice: number;
}) {
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
    [params.userId]
  );

  const row = result.rows[0];
  const dealerLabel = row?.company_name || row?.contact_name || row?.email || `user #${params.userId}`;
  const orderLabel = `ORD-${params.orderId}`;

  await writeAuditLog({
    userId: params.userId,
    action: "CREATE",
    tableName: "orders",
    recordId: params.orderId,
    newValues: {
      event: "customer_order",
      order_label: orderLabel,
      total_price: params.totalPrice,
      dealer_name: dealerLabel,
      summary: `${dealerLabel} placed ${orderLabel} for ${formatPrice(params.totalPrice)}.`,
    },
  });
}

export async function logOrderStatusChange(params: {
  adminUserId: number;
  orderId: number;
  oldStatus: string;
  newStatus: string;
  dealerLabel?: string | null;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);
  const orderLabel = `ORD-${params.orderId}`;
  const dealerSuffix = params.dealerLabel ? ` (${params.dealerLabel})` : "";

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "orders",
    recordId: params.orderId,
    oldValues: {
      status: params.oldStatus,
      order_label: orderLabel,
    },
    newValues: {
      status: params.newStatus,
      order_label: orderLabel,
      summary: `${adminEmail} changed ${orderLabel}${dealerSuffix} status from ${params.oldStatus} to ${params.newStatus}.`,
    },
  });
}
