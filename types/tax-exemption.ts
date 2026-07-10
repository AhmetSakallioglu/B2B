export type TaxExemptionStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export type TaxExemptionProfile = {
  isTaxExempt: boolean;
  taxExemptionStatus: TaxExemptionStatus;
  resaleCertificateUrl: string | null;
  taxExemptionRejectionReason: string | null;
  resaleLicenseNumber: string | null;
};

export type TaxExemptionReviewItem = {
  userId: number;
  email: string;
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  resaleLicenseNumber: string | null;
  taxExemptionStatus: TaxExemptionStatus;
  isTaxExempt: boolean;
  resaleCertificateUrl: string | null;
  submittedAt: string | null;
};

export const TAX_EXEMPTION_STATUS_LABELS: Record<TaxExemptionStatus, string> = {
  NONE: "Not submitted",
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
