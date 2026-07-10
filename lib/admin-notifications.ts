import { query } from "@/lib/db";

export type AdminNotificationCounts = {
  pendingUsers: number;
  pendingOrders: number;
};

export async function getAdminNotificationCounts(): Promise<AdminNotificationCounts> {
  const result = await query<{
    pending_users: string;
    pending_orders: string;
  }>(
    `
      SELECT
        (
          SELECT COUNT(*)::text
          FROM users
          WHERE role = 'customer'
            AND account_status = 'pending'
        ) AS pending_users,
        (
          SELECT COUNT(*)::text
          FROM orders
          WHERE status = 'pending'
        ) AS pending_orders
    `
  );

  const row = result.rows[0];

  return {
    pendingUsers: Number.parseInt(row?.pending_users ?? "0", 10),
    pendingOrders: Number.parseInt(row?.pending_orders ?? "0", 10),
  };
}
