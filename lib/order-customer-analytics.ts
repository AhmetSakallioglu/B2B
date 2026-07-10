import { query } from "@/lib/db";
import { RECOGNIZED_ORDER_STATUS_SQL, type OrderStatus } from "@/lib/order-status";
import type {
  OrderCustomerSummary,
  OrderCustomerSummaryRow,
} from "@/types/order-customer-analytics";

function toNumber(value: string | number) {
  return Number.parseFloat(String(value));
}

function mapOrderCustomerSummaryRow(row: OrderCustomerSummaryRow): OrderCustomerSummary {
  const totalOrders = Number.parseInt(row.total_orders, 10);
  const lifetimeValue = toNumber(row.lifetime_value);
  const statusBreakdown: Record<OrderStatus, number> = {
    pending: Number.parseInt(row.pending_count, 10),
    processing: Number.parseInt(row.processing_count, 10),
    confirmed: Number.parseInt(row.confirmed_count, 10),
    shipped: Number.parseInt(row.shipped_count, 10),
    completed: Number.parseInt(row.completed_count, 10),
    cancelled: Number.parseInt(row.cancelled_count, 10),
    waiting_for_modification_payment: Number.parseInt(
      row.waiting_for_modification_payment_count,
      10
    ),
  };

  return {
    userId: row.user_id,
    contactName: row.contact_name?.trim() || "—",
    companyName: row.company_name?.trim() || "—",
    email: row.email,
    phone: row.phone?.trim() || "—",
    totalOrders,
    lifetimeValue,
    averageOrderValue:
      totalOrders > 0 ? Math.round((lifetimeValue / totalOrders) * 100) / 100 : 0,
    statusBreakdown,
  };
}

export async function listOrderCustomerSummaries(): Promise<OrderCustomerSummary[]> {
  const result = await query<OrderCustomerSummaryRow>(
    `
      SELECT
        u.id AS user_id,
        u.contact_name,
        u.company_name,
        u.email,
        u.phone,
        COUNT(o.id)::text AS total_orders,
        COALESCE(
          SUM(o.total_price) FILTER (WHERE o.status IN ${RECOGNIZED_ORDER_STATUS_SQL}),
          0
        )::text AS lifetime_value,
        COUNT(o.id) FILTER (WHERE o.status = 'pending')::text AS pending_count,
        COUNT(o.id) FILTER (WHERE o.status = 'processing')::text AS processing_count,
        COUNT(o.id) FILTER (WHERE o.status = 'confirmed')::text AS confirmed_count,
        COUNT(o.id) FILTER (WHERE o.status = 'shipped')::text AS shipped_count,
        COUNT(o.id) FILTER (WHERE o.status = 'completed')::text AS completed_count,
        COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::text AS cancelled_count,
        COUNT(o.id) FILTER (
          WHERE o.status = 'waiting_for_modification_payment'
        )::text AS waiting_for_modification_payment_count
      FROM users u
      INNER JOIN orders o ON o.user_id = u.id
      WHERE u.role = 'customer'
      GROUP BY u.id, u.contact_name, u.company_name, u.email, u.phone
      ORDER BY
        COALESCE(
          SUM(o.total_price) FILTER (WHERE o.status IN ${RECOGNIZED_ORDER_STATUS_SQL}),
          0
        ) DESC,
        COUNT(o.id) DESC,
        u.company_name ASC NULLS LAST
    `
  );

  return result.rows.map(mapOrderCustomerSummaryRow);
}
