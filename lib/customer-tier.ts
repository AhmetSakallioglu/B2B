import { query } from "@/lib/db";
import { mapCustomerTierRow } from "@/lib/pricing";
import type { CustomerTier, CustomerTierRow } from "@/types/customer-tier";

export async function getCustomerTiers() {
  const result = await query<CustomerTierRow>(
    `
      SELECT id, name, level, discount_percent, description
      FROM customer_tiers
      ORDER BY level ASC
    `
  );

  return result.rows.map(mapCustomerTierRow);
}

export async function getCustomerTierById(tierId: number) {
  const result = await query<CustomerTierRow>(
    `
      SELECT id, name, level, discount_percent, description
      FROM customer_tiers
      WHERE id = $1
    `,
    [tierId]
  );

  return result.rows.length > 0 ? mapCustomerTierRow(result.rows[0]) : null;
}

export async function getUserTier(userId: number): Promise<CustomerTier | null> {
  const result = await query<CustomerTierRow>(
    `
      SELECT
        ct.id,
        ct.name,
        ct.level,
        ct.discount_percent,
        ct.description
      FROM users u
      JOIN customer_tiers ct ON ct.id = u.tier_id
      WHERE u.id = $1 AND u.role = 'customer'
    `,
    [userId]
  );

  return result.rows.length > 0 ? mapCustomerTierRow(result.rows[0]) : null;
}

export async function getUserDiscountPercent(userId: number, role: string) {
  if (role !== "customer") {
    return 0;
  }

  const tier = await getUserTier(userId);
  return tier?.discountPercent ?? 0;
}

export function mapAdminUserTier(row: {
  tier_id: number | null;
  tier_name: string | null;
  tier_level: number | null;
  tier_discount_percent: string | null;
  tier_description: string | null;
}): CustomerTier | null {
  if (
    row.tier_id === null ||
    row.tier_name === null ||
    row.tier_level === null ||
    row.tier_discount_percent === null
  ) {
    return null;
  }

  return {
    id: row.tier_id,
    name: row.tier_name,
    level: row.tier_level,
    discountPercent: Number.parseFloat(row.tier_discount_percent),
    description: row.tier_description ?? "",
  };
}

export const ADMIN_USER_SELECT = `
  u.id,
  u.email,
  u.role,
  u.account_status,
  u.company_name,
  u.contact_name,
  u.phone,
  u.address_line1,
  u.address_line2,
  u.city,
  u.state,
  u.postal_code,
  u.country,
  u.alternate_phone,
  u.fax,
  u.billing_first_name,
  u.billing_last_name,
  u.billing_phone,
  u.shipping_same_as_billing,
  u.shipping_first_name,
  u.shipping_last_name,
  u.shipping_address_line1,
  u.shipping_address_line2,
  u.shipping_city,
  u.shipping_state,
  u.shipping_postal_code,
  u.shipping_country,
  u.shipping_phone,
  u.federal_tax_id,
  u.application_notes,
  u.tax_status,
  u.is_tax_exempt,
  u.tax_exemption_status,
  u.resale_certificate_url,
  u.tax_exemption_rejection_reason,
  u.business_type,
  u.expected_monthly_sales,
  u.sales_tax_account,
  u.has_resale_license,
  u.resale_license_number,
  u.tax_document_url,
  u.created_at,
  u.reviewed_at,
  u.tier_id,
  u.group_tag,
  ct.name AS tier_name,
  ct.level AS tier_level,
  ct.discount_percent AS tier_discount_percent,
  ct.description AS tier_description
`;
