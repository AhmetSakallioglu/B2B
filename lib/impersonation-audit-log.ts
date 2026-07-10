import { writeAuditLog } from "@/lib/audit-log";
import { query } from "@/lib/db";

export async function logImpersonatedOrderCreated(params: {
  adminId: number;
  customerUserId: number;
  orderId: number;
}) {
  const result = await query<{
    admin_name: string | null;
    admin_email: string;
    customer_name: string | null;
    customer_email: string;
    company_name: string | null;
  }>(
    `
      SELECT
        admin.contact_name AS admin_name,
        admin.email AS admin_email,
        customer.contact_name AS customer_name,
        customer.email AS customer_email,
        customer.company_name
      FROM users admin
      INNER JOIN users customer ON customer.id = $2
      WHERE admin.id = $1
    `,
    [params.adminId, params.customerUserId]
  );

  const row = result.rows[0];

  if (!row) {
    return;
  }

  const dealerLabel =
    row.company_name ||
    row.customer_name ||
    row.customer_email;
  const adminLabel = row.admin_name || row.admin_email;

  await writeAuditLog({
    userId: params.adminId,
    action: "CREATE",
    tableName: "orders",
    recordId: params.orderId,
    newValues: {
      event: "impersonated_order",
      order_id: params.orderId,
      order_label: `ORD-${params.orderId}`,
      admin_name: adminLabel,
      dealer_name: dealerLabel,
      customer_user_id: params.customerUserId,
      summary: `Admin ${adminLabel} created order ORD-${params.orderId} on behalf of ${dealerLabel} via phone/impersonation.`,
    },
  });
}

export async function logImpersonationStopped(params: {
  adminId: number;
  customerUserId: number;
  customerEmail: string;
  companyName: string | null;
  contactName: string | null;
}) {
  const result = await query<{
    admin_name: string | null;
    admin_email: string;
  }>(
    `
      SELECT contact_name AS admin_name, email AS admin_email
      FROM users
      WHERE id = $1
    `,
    [params.adminId]
  );

  const admin = result.rows[0];
  const adminLabel = admin?.admin_name || admin?.admin_email || `admin #${params.adminId}`;
  const dealerLabel =
    params.companyName || params.contactName || params.customerEmail;

  await writeAuditLog({
    userId: params.adminId,
    action: "UPDATE",
    tableName: "users",
    recordId: params.customerUserId,
    newValues: {
      event: "impersonation_stopped",
      customer_email: params.customerEmail,
      summary: `Admin ${adminLabel} stopped impersonating dealer ${dealerLabel}.`,
    },
  });
}

export async function logImpersonationStarted(params: {
  adminId: number;
  customerUserId: number;
  customerEmail: string;
  companyName: string | null;
  contactName: string | null;
}) {
  const result = await query<{
    admin_name: string | null;
    admin_email: string;
  }>(
    `
      SELECT contact_name AS admin_name, email AS admin_email
      FROM users
      WHERE id = $1
    `,
    [params.adminId]
  );

  const admin = result.rows[0];
  const adminLabel = admin?.admin_name || admin?.admin_email || `admin #${params.adminId}`;
  const dealerLabel =
    params.companyName || params.contactName || params.customerEmail;

  await writeAuditLog({
    userId: params.adminId,
    action: "UPDATE",
    tableName: "users",
    recordId: params.customerUserId,
    newValues: {
      event: "impersonation_started",
      customer_email: params.customerEmail,
      summary: `Admin ${adminLabel} started impersonating dealer ${dealerLabel}.`,
    },
  });
}
