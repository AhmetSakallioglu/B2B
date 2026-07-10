import type { UserRole } from "@/types/auth";
import type { CustomerTier } from "@/types/customer-tier";

import type { TaxExemptionStatus } from "@/types/tax-exemption";

export type UserProfile = {
  id: number;
  email: string;
  role: UserRole;
  taxStatus: "taxable" | "exempt";
  isTaxExempt: boolean;
  taxExemptionStatus: TaxExemptionStatus;
  resaleCertificateUrl: string | null;
  taxExemptionRejectionReason: string | null;
  resaleLicenseNumber: string | null;
  companyName: string;
  contactName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  tier: CustomerTier | null;
};

export type UserProfileRow = {
  id: number;
  email: string;
  role: UserRole;
  tax_status: "taxable" | "exempt";
  is_tax_exempt: boolean;
  tax_exemption_status: TaxExemptionStatus;
  resale_certificate_url: string | null;
  tax_exemption_rejection_reason: string | null;
  resale_license_number: string | null;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

export type UpdateProfileBody = {
  companyName?: string;
  contactName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type UpdateCredentialsBody = {
  email?: string;
  currentPassword: string;
  newPassword?: string;
  confirmNewPassword?: string;
};
