import { query } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { sendTaxExemptionDecisionEmail } from "@/lib/tax-exemption-notify";
import type { TaxExemptionReviewItem, TaxExemptionStatus } from "@/types/tax-exemption";

type TaxExemptionUserRow = {
  id: number;
  email: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  resale_license_number: string | null;
  tax_exemption_status: TaxExemptionStatus;
  is_tax_exempt: boolean;
  resale_certificate_url: string | null;
  tax_document_url: string | null;
  updated_at: Date;
};

function mapReviewItem(row: TaxExemptionUserRow): TaxExemptionReviewItem {
  return {
    userId: row.id,
    email: row.email,
    companyName: row.company_name,
    contactName: row.contact_name,
    phone: row.phone,
    resaleLicenseNumber: row.resale_license_number,
    taxExemptionStatus: row.tax_exemption_status,
    isTaxExempt: row.is_tax_exempt,
    resaleCertificateUrl: row.resale_certificate_url ?? row.tax_document_url,
    submittedAt: row.updated_at.toISOString(),
  };
}

export function isApprovedTaxExempt(params: {
  isTaxExempt: boolean;
  taxExemptionStatus: TaxExemptionStatus;
}) {
  return params.isTaxExempt && params.taxExemptionStatus === "APPROVED";
}

export async function fetchDealerTaxExemption(userId: number) {
  const result = await query<{
    is_tax_exempt: boolean;
    tax_exemption_status: TaxExemptionStatus;
    tax_status: "taxable" | "exempt";
  }>(
    `
      SELECT is_tax_exempt, tax_exemption_status, tax_status
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const approved = isApprovedTaxExempt({
    isTaxExempt: row.is_tax_exempt,
    taxExemptionStatus: row.tax_exemption_status,
  });

  return {
    isTaxExempt: approved,
    taxExemptionStatus: row.tax_exemption_status,
    taxStatus: approved ? ("exempt" as const) : ("taxable" as const),
  };
}

export async function listPendingTaxExemptionReviews(): Promise<TaxExemptionReviewItem[]> {
  const result = await query<TaxExemptionUserRow>(
    `
      SELECT
        id,
        email,
        company_name,
        contact_name,
        phone,
        resale_license_number,
        tax_exemption_status,
        is_tax_exempt,
        resale_certificate_url,
        tax_document_url,
        updated_at
      FROM users
      WHERE role = 'customer'
        AND tax_exemption_status = 'PENDING'
        AND COALESCE(resale_certificate_url, tax_document_url) IS NOT NULL
      ORDER BY updated_at ASC
    `
  );

  return result.rows.map(mapReviewItem);
}

export async function submitResaleCertificate(params: {
  userId: number;
  certificateUrl: string;
}) {
  await query(
    `
      UPDATE users
      SET
        resale_certificate_url = $2,
        tax_document_url = $2,
        tax_exemption_status = 'PENDING',
        is_tax_exempt = false,
        tax_status = 'taxable',
        tax_exemption_rejection_reason = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND role = 'customer'
    `,
    [params.userId, params.certificateUrl]
  );
}

export async function reviewTaxExemption(params: {
  adminUserId: number;
  userId: number;
  decision: "approve" | "reject";
  reason?: string | null;
}) {
  const existing = await query<TaxExemptionUserRow>(
    `
      SELECT
        id,
        email,
        company_name,
        contact_name,
        phone,
        resale_license_number,
        tax_exemption_status,
        is_tax_exempt,
        resale_certificate_url,
        tax_document_url,
        updated_at
      FROM users
      WHERE id = $1
        AND role = 'customer'
    `,
    [params.userId]
  );

  const user = existing.rows[0];

  if (!user) {
    return { ok: false as const, error: "Dealer not found", status: 404 as const };
  }

  if (user.tax_exemption_status !== "PENDING") {
    return {
      ok: false as const,
      error: "Only pending tax exemption requests can be reviewed",
      status: 400 as const,
    };
  }

  const certificateUrl = user.resale_certificate_url ?? user.tax_document_url;

  if (!certificateUrl) {
    return {
      ok: false as const,
      error: "No resale certificate on file",
      status: 400 as const,
    };
  }

  const rejectionReason =
    params.decision === "reject" ? params.reason?.trim() || "Document did not meet requirements" : null;

  if (params.decision === "approve") {
    await query(
      `
        UPDATE users
        SET
          is_tax_exempt = true,
          tax_exemption_status = 'APPROVED',
          tax_status = 'exempt',
          tax_exemption_rejection_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
      `,
      [params.userId]
    );
  } else {
    await query(
      `
        UPDATE users
        SET
          is_tax_exempt = false,
          tax_exemption_status = 'REJECTED',
          tax_status = 'taxable',
          tax_exemption_rejection_reason = $2,
          updated_at = NOW()
        WHERE id = $1
      `,
      [params.userId, rejectionReason]
    );
  }

  const auditDetails = {
    targetUserId: params.userId,
    targetUserEmail: user.email,
    certificateUrl,
    reviewedAt: new Date().toISOString(),
    decision: params.decision,
    rejectionReason,
  };

  await writeAuditLog({
    userId: params.adminUserId,
    action:
      params.decision === "approve"
        ? "USER_TAX_EXEMPTION_APPROVED"
        : "USER_TAX_EXEMPTION_REJECTED",
    tableName: "users",
    recordId: params.userId,
    oldValues: {
      is_tax_exempt: user.is_tax_exempt,
      tax_exemption_status: user.tax_exemption_status,
      resale_certificate_url: certificateUrl,
    },
    newValues: auditDetails,
  });

  await sendTaxExemptionDecisionEmail({
    email: user.email,
    companyName: user.company_name,
    contactName: user.contact_name,
    decision: params.decision,
    rejectionReason,
  });

  return {
    ok: true as const,
    item: mapReviewItem({
      ...user,
      is_tax_exempt: params.decision === "approve",
      tax_exemption_status: params.decision === "approve" ? "APPROVED" : "REJECTED",
      updated_at: new Date(),
    }),
  };
}
