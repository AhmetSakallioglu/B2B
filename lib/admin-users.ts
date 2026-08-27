import type {
  AdminUserDetail,
  AdminUserRow,
  AdminUserSummary,
  AdminUserTierView,
} from "@/types/customer-tier";
import { mapAdminUserTier } from "@/lib/customer-tier";
import { parseAccountStatus } from "@/lib/user-approval";
import { validatePassword } from "@/lib/password-policy";
import { isUserGroupTag } from "@/types/user-segmentation";

export function mapAdminUserSummary(row: AdminUserRow): AdminUserSummary {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    accountStatus: row.account_status,
    companyName: row.company_name ?? "",
    contactName: row.contact_name ?? "",
    phone: row.phone ?? "",
    city: row.city ?? "",
    tier: mapAdminUserTier(row),
    groupTag: row.group_tag ?? "New",
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export function mapAdminUserDetail(row: AdminUserRow): AdminUserDetail {
  return {
    ...mapAdminUserSummary(row),
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? "",
    state: row.state ?? "",
    postalCode: row.postal_code ?? "",
    country: row.country ?? "",
    alternatePhone: row.alternate_phone ?? "",
    fax: row.fax ?? "",
    billingFirstName: row.billing_first_name ?? "",
    billingLastName: row.billing_last_name ?? "",
    billingPhone: row.billing_phone ?? "",
    shippingSameAsBilling: row.shipping_same_as_billing ?? false,
    shippingFirstName: row.shipping_first_name ?? "",
    shippingLastName: row.shipping_last_name ?? "",
    shippingAddressLine1: row.shipping_address_line1 ?? "",
    shippingAddressLine2: row.shipping_address_line2 ?? "",
    shippingCity: row.shipping_city ?? "",
    shippingState: row.shipping_state ?? "",
    shippingPostalCode: row.shipping_postal_code ?? "",
    shippingCountry: row.shipping_country ?? "",
    shippingPhone: row.shipping_phone ?? "",
    federalTaxId: row.federal_tax_id ?? "",
    applicationNotes: row.application_notes ?? "",
    taxStatus: row.tax_status ?? "taxable",
    isTaxExempt: row.is_tax_exempt ?? false,
    taxExemptionStatus: row.tax_exemption_status ?? "NONE",
    resaleCertificateUrl: row.resale_certificate_url ?? row.tax_document_url ?? "",
    taxExemptionRejectionReason: row.tax_exemption_rejection_reason ?? "",
    businessType: row.business_type ?? "",
    expectedMonthlySales: row.expected_monthly_sales ?? "",
    salesTaxAccount: row.sales_tax_account ?? "",
    hasResaleLicense: row.has_resale_license,
    resaleLicenseNumber: row.resale_license_number ?? "",
    taxDocumentUrl: row.tax_document_url ?? "",
  };
}

export function mapAdminUserTierView(row: AdminUserRow): AdminUserTierView {
  return {
    ...mapAdminUserSummary(row),
    taxStatus: row.tax_status ?? "taxable",
  };
}

export function parseUpdateAdminUserBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  const trim = (value: unknown) => (typeof value === "string" ? value.trim() : undefined);

  const role =
    candidate.role === "admin" || candidate.role === "customer"
      ? candidate.role
      : undefined;

  const accountStatus = parseAccountStatus(candidate.accountStatus) ?? undefined;

  let tierId: number | null | undefined;

  if (candidate.tierId === null) {
    tierId = null;
  } else if (typeof candidate.tierId === "number" && Number.isInteger(candidate.tierId)) {
    tierId = candidate.tierId;
  }

  const groupTag =
    typeof candidate.groupTag === "string" && isUserGroupTag(candidate.groupTag.trim())
      ? candidate.groupTag.trim()
      : undefined;

  return {
    role,
    accountStatus,
    tierId,
    companyName: trim(candidate.companyName),
    contactName: trim(candidate.contactName),
    phone: trim(candidate.phone),
    addressLine1: trim(candidate.addressLine1),
    addressLine2: trim(candidate.addressLine2),
    city: trim(candidate.city),
    state: trim(candidate.state),
    postalCode: trim(candidate.postalCode),
    country: trim(candidate.country),
    groupTag,
  };
}

export type UpdateAdminUserBody = NonNullable<ReturnType<typeof parseUpdateAdminUserBody>>;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function parseCreateAdminUserBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return { error: "Invalid member payload" as const };
  }

  const candidate = body as Record<string, unknown>;
  const trim = (value: unknown, maxLength: number) => {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim().slice(0, maxLength);
  };

  const email = trim(candidate.email, 255).toLowerCase();

  if (!email || !isValidEmail(email)) {
    return { error: "A valid email is required" as const };
  }

  const password =
    typeof candidate.password === "string" && candidate.password.length > 0
      ? candidate.password
      : null;

  if (password) {
    const passwordError = validatePassword(password);

    if (passwordError) {
      return { error: passwordError };
    }
  }

  const accountStatus = parseAccountStatus(candidate.accountStatus);
  const nextStatus = accountStatus === "approved" ? "approved" : "pending";

  if (accountStatus === "rejected" || accountStatus === "deleted") {
    return { error: "New members cannot be created as banned or deleted" as const };
  }

  return {
    data: {
      email,
      password,
      accountStatus: nextStatus,
      companyName: trim(candidate.companyName, 150),
      contactName: trim(candidate.contactName, 150),
      phone: trim(candidate.phone, 50),
      addressLine1: trim(candidate.addressLine1, 255),
      addressLine2: trim(candidate.addressLine2, 255),
      city: trim(candidate.city, 100),
      state: trim(candidate.state, 100),
      postalCode: trim(candidate.postalCode, 30),
      country: trim(candidate.country, 100) || "United States",
    },
  };
}

export type CreateAdminUserBody = NonNullable<
  Extract<ReturnType<typeof parseCreateAdminUserBody>, { data: unknown }>["data"]
>;

export function parseUpsertCustomerTierBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.name !== "string" || typeof candidate.level !== "number") {
    return null;
  }

  if (
    typeof candidate.discountPercent !== "number" ||
    !Number.isFinite(candidate.discountPercent) ||
    candidate.discountPercent < 0 ||
    candidate.discountPercent > 100
  ) {
    return null;
  }

  const name = candidate.name.trim();
  const level = Math.trunc(candidate.level);

  if (!name || level <= 0) {
    return null;
  }

  return {
    name,
    level,
    discountPercent: candidate.discountPercent,
    description:
      typeof candidate.description === "string" ? candidate.description.trim() : "",
  };
}
