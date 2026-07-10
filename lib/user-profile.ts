import type {
  UpdateCredentialsBody,
  UpdateProfileBody,
  UserProfile,
  UserProfileRow,
} from "@/types/account";
import { validatePassword } from "@/lib/password-policy";

const FIELD_LIMITS = {
  companyName: 150,
  contactName: 150,
  phone: 50,
  addressLine1: 255,
  addressLine2: 255,
  city: 100,
  state: 100,
  postalCode: 30,
  country: 100,
} as const;

function trimTo(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export function mapUserProfileRow(
  row: UserProfileRow,
  tier: UserProfile["tier"] = null
): UserProfile {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    taxStatus: row.tax_status ?? "taxable",
    isTaxExempt: row.is_tax_exempt ?? false,
    taxExemptionStatus: row.tax_exemption_status ?? "NONE",
    resaleCertificateUrl: row.resale_certificate_url ?? null,
    taxExemptionRejectionReason: row.tax_exemption_rejection_reason ?? null,
    resaleLicenseNumber: row.resale_license_number ?? null,
    companyName: row.company_name ?? "",
    contactName: row.contact_name ?? "",
    phone: row.phone ?? "",
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    postalCode: row.postal_code ?? "",
    country: row.country ?? "United States",
    tier,
  };
}

export function parseUpdateProfileBody(body: unknown): UpdateProfileBody | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  return {
    companyName: trimTo(candidate.companyName, FIELD_LIMITS.companyName),
    contactName: trimTo(candidate.contactName, FIELD_LIMITS.contactName),
    phone: trimTo(candidate.phone, FIELD_LIMITS.phone),
    addressLine1: trimTo(candidate.addressLine1, FIELD_LIMITS.addressLine1),
    addressLine2: trimTo(candidate.addressLine2, FIELD_LIMITS.addressLine2),
    city: trimTo(candidate.city, FIELD_LIMITS.city),
    state: trimTo(candidate.state, FIELD_LIMITS.state),
    postalCode: trimTo(candidate.postalCode, FIELD_LIMITS.postalCode),
    country: trimTo(candidate.country, FIELD_LIMITS.country) || "United States",
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function parseUpdateCredentialsBody(
  body: unknown
): UpdateCredentialsBody | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.currentPassword !== "string") {
    return null;
  }

  const currentPassword = candidate.currentPassword;

  if (currentPassword.length === 0) {
    return null;
  }

  const email =
    typeof candidate.email === "string"
      ? candidate.email.trim().toLowerCase()
      : undefined;

  if (email !== undefined && !isValidEmail(email)) {
    return null;
  }

  const newPassword =
    typeof candidate.newPassword === "string" ? candidate.newPassword : undefined;
  const confirmNewPassword =
    typeof candidate.confirmNewPassword === "string"
      ? candidate.confirmNewPassword
      : undefined;

  if (newPassword !== undefined) {
    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      return null;
    }
  }

  if (
    (newPassword && !confirmNewPassword) ||
    (!newPassword && confirmNewPassword)
  ) {
    return null;
  }

  if (newPassword && newPassword !== confirmNewPassword) {
    return null;
  }

  return {
    email,
    currentPassword,
    newPassword,
    confirmNewPassword,
  };
}

export const USER_PROFILE_SELECT = `
  id,
  email,
  role,
  tax_status,
  is_tax_exempt,
  tax_exemption_status,
  resale_certificate_url,
  tax_exemption_rejection_reason,
  resale_license_number,
  company_name,
  contact_name,
  phone,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  country
`;

export type OrderRequiredProfile = Pick<
  UserProfile,
  | "companyName"
  | "contactName"
  | "phone"
  | "addressLine1"
  | "city"
  | "state"
  | "postalCode"
  | "country"
>;

const ORDER_REQUIRED_FIELD_LABELS: Record<keyof OrderRequiredProfile, string> = {
  companyName: "Company name",
  contactName: "Contact name",
  phone: "Phone",
  addressLine1: "Address line 1",
  city: "City",
  state: "State / Province",
  postalCode: "Postal code",
  country: "Country",
};

export function getMissingProfileFieldsForOrdering(
  profile: OrderRequiredProfile
): string[] {
  return (Object.keys(ORDER_REQUIRED_FIELD_LABELS) as (keyof OrderRequiredProfile)[])
    .filter((field) => profile[field].trim().length === 0)
    .map((field) => ORDER_REQUIRED_FIELD_LABELS[field]);
}

export function isProfileCompleteForOrdering(profile: OrderRequiredProfile) {
  return getMissingProfileFieldsForOrdering(profile).length === 0;
}

export const ORDER_PROFILE_INCOMPLETE_MESSAGE =
  "Complete your company and address details in My Account before placing an order.";
