import type { AccountStatus } from "@/lib/user-approval";
import type { TaxExemptionStatus } from "@/types/tax-exemption";

export type CustomerTier = {
  id: number;
  name: string;
  level: number;
  discountPercent: number;
  description: string;
};

export type CustomerTierRow = {
  id: number;
  name: string;
  level: number;
  discount_percent: string;
  description: string | null;
};

export type AdminUserSummary = {
  id: number;
  email: string;
  role: "customer" | "admin";
  accountStatus: AccountStatus;
  companyName: string;
  contactName: string;
  phone: string;
  city: string;
  tier: CustomerTier | null;
  groupTag: string;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminUserTierView = AdminUserSummary & {
  taxStatus: "taxable" | "exempt";
};

export type AdminUserDetail = AdminUserSummary & {
  addressLine1: string;
  addressLine2: string;
  state: string;
  postalCode: string;
  country: string;
  alternatePhone: string;
  fax: string;
  billingFirstName: string;
  billingLastName: string;
  billingPhone: string;
  shippingSameAsBilling: boolean;
  shippingFirstName: string;
  shippingLastName: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingPhone: string;
  federalTaxId: string;
  applicationNotes: string;
  taxStatus: "taxable" | "exempt";
  isTaxExempt: boolean;
  taxExemptionStatus: TaxExemptionStatus;
  resaleCertificateUrl: string;
  taxExemptionRejectionReason: string;
  businessType: string;
  expectedMonthlySales: string;
  salesTaxAccount: string;
  hasResaleLicense: boolean | null;
  resaleLicenseNumber: string;
  taxDocumentUrl: string;
};

export type AdminUserRow = {
  id: number;
  email: string;
  role: "customer" | "admin";
  account_status: AccountStatus;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  alternate_phone: string | null;
  fax: string | null;
  billing_first_name: string | null;
  billing_last_name: string | null;
  billing_phone: string | null;
  shipping_same_as_billing: boolean;
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  shipping_phone: string | null;
  federal_tax_id: string | null;
  application_notes: string | null;
  tax_status: "taxable" | "exempt";
  is_tax_exempt: boolean;
  tax_exemption_status: TaxExemptionStatus;
  resale_certificate_url: string | null;
  tax_exemption_rejection_reason: string | null;
  business_type: string | null;
  expected_monthly_sales: string | null;
  sales_tax_account: string | null;
  has_resale_license: boolean | null;
  resale_license_number: string | null;
  tax_document_url: string | null;
  created_at: string;
  reviewed_at: string | null;
  tier_id: number | null;
  tier_name: string | null;
  tier_level: number | null;
  tier_discount_percent: string | null;
  tier_description: string | null;
  group_tag: string;
};

export type UpdateAdminUserBody = {
  role?: "customer" | "admin";
  accountStatus?: AccountStatus;
  tierId?: number | null;
  companyName?: string;
  contactName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  groupTag?: string;
};

export type UpsertCustomerTierBody = {
  name: string;
  level: number;
  discountPercent: number;
  description?: string;
};
