import { query } from "@/lib/db";
import { loadAbandonedCartDealerContext } from "@/lib/abandoned-cart";
import type { AbandonedCartDealerContext } from "@/types/abandoned-cart";

export async function loadDealerEmailContext(
  userId: number
): Promise<AbandonedCartDealerContext | null> {
  const cartContext = await loadAbandonedCartDealerContext(userId);

  if (cartContext) {
    return cartContext;
  }

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

  return {
    userId,
    email: user.email,
    contactName: user.contact_name,
    companyName: user.company_name,
    lastCartActivityAt: new Date().toISOString(),
    mailStatus: 0,
    items: [],
    cartTotal: 0,
  };
}

export async function listApprovedCustomerIdsByGroup(groupTag: string) {
  const result = await query<{ id: number }>(
    `
      SELECT id
      FROM users
      WHERE role = 'customer'
        AND account_status = 'approved'
        AND group_tag = $1
      ORDER BY id ASC
    `,
    [groupTag]
  );

  return result.rows.map((row) => row.id);
}
