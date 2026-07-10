import { validatePassword } from "@/lib/password-policy";
import { sanitizeOptionalPlainText, sanitizePlainText } from "@/lib/input-sanitization";
import { DEFAULT_COUNTRY, US_STATE_CODES } from "@/lib/us-states";

export type TaxStatus = "taxable" | "exempt";

export const BUSINESS_TYPE_OPTIONS = [
  "Contractor",
  "Builder",
  "Interior Designer",
  "Kitchen Retailer",
  "Property Manager",
  "Other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPE_OPTIONS)[number];

export const EXPECTED_MONTHLY_SALES_OPTIONS = [
  "Under $5,000",
  "$5,000 - $20,000",
  "$20,000+",
] as const;

export type ExpectedMonthlySales = (typeof EXPECTED_MONTHLY_SALES_OPTIONS)[number];

export const CERTIFICATE_OF_EXEMPTION_URL = "/form1_texas_resale_crtificate.pdf";

const LIMITS = {
  companyName: 150,
  name: 100,
  phone: 50,
  email: 255,
  address: 255,
  city: 100,
  state: 2,
  postalCode: 10,
  fax: 50,
  federalTaxId: 20,
  notes: 4000,
  businessType: 50,
  expectedMonthlySales: 50,
  salesTaxAccount: 100,
  resaleLicenseNumber: 100,
} as const;

export type DealerAddressInput = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

export type DealerApplicationInput = {
  companyName: string;
  phone: string;
  alternatePhone: string;
  fax: string;
  email: string;
  password: string;
  confirmPassword: string;
  billing: DealerAddressInput;
  shippingSameAsBilling: boolean;
  shipping: DealerAddressInput;
  taxStatus: TaxStatus;
  federalTaxId: string;
  businessType: string;
  expectedMonthlySales: string;
  salesTaxAccount: string;
  hasResaleLicense: boolean | null;
  resaleLicenseNumber: string;
  notes: string;
  acceptedTerms: boolean;
  recaptchaToken: string | null;
};

export type ParsedDealerApplication = {
  companyName: string;
  phone: string;
  alternatePhone: string | null;
  fax: string | null;
  email: string;
  password: string;
  billingFirstName: string;
  billingLastName: string;
  billingPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  contactName: string;
  shippingSameAsBilling: boolean;
  shippingFirstName: string;
  shippingLastName: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingPhone: string;
  taxStatus: TaxStatus;
  federalTaxId: string;
  businessType: string | null;
  expectedMonthlySales: string | null;
  salesTaxAccount: string | null;
  hasResaleLicense: boolean | null;
  resaleLicenseNumber: string | null;
  taxDocumentUrl: string | null;
  applicationNotes: string | null;
};

function sanitizeText(value: unknown, maxLength: number, required = false) {
  return sanitizePlainText(value, maxLength, required);
}

function sanitizeOptional(value: unknown, maxLength: number) {
  return sanitizeOptionalPlainText(value, maxLength);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? value.trim().slice(0, LIMITS.phone) : null;
}

function normalizeEin(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 9) {
    return null;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function normalizeZip(value: string) {
  const cleaned = value.trim();

  if (!/^\d{5}(-\d{4})?$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

function parseTaxStatus(value: unknown): TaxStatus | null {
  return value === "taxable" || value === "exempt" ? value : null;
}

function parseResaleLicense(value: unknown): boolean | null {
  if (value === true || value === "yes") {
    return true;
  }

  if (value === false || value === "no") {
    return false;
  }

  return null;
}

function parseAddressBlock(source: unknown, required: boolean): DealerAddressInput | null {
  if (!source || typeof source !== "object") {
    return required ? null : null;
  }

  const record = source as Record<string, unknown>;

  const firstName = sanitizeText(record.firstName, LIMITS.name, true);
  const lastName = sanitizeText(record.lastName, LIMITS.name, true);
  const addressLine1 = sanitizeText(record.addressLine1, LIMITS.address, true);
  const addressLine2 = sanitizeText(record.addressLine2, LIMITS.address, false) ?? "";
  const city = sanitizeText(record.city, LIMITS.city, true);
  const stateRaw = sanitizeText(record.state, LIMITS.state, true);
  const postalCodeRaw = sanitizeText(record.postalCode, LIMITS.postalCode, true);
  const country = sanitizeText(record.country, 100, true) ?? DEFAULT_COUNTRY;
  const phoneRaw = sanitizeText(record.phone, LIMITS.phone, true);

  if (!firstName || !lastName || !addressLine1 || !city || !stateRaw || !postalCodeRaw || !phoneRaw) {
    return required ? null : null;
  }

  if (!US_STATE_CODES.has(stateRaw as never)) {
    return null;
  }

  const postalCode = normalizeZip(postalCodeRaw);
  const phone = normalizePhone(phoneRaw);

  if (!postalCode || !phone) {
    return null;
  }

  if (country !== DEFAULT_COUNTRY) {
    return null;
  }

  return {
    firstName,
    lastName,
    addressLine1,
    addressLine2,
    city,
    state: stateRaw,
    postalCode,
    country: DEFAULT_COUNTRY,
    phone,
  };
}

export function parseDealerApplicationBody(
  body: unknown,
  options?: { taxDocumentProvided?: boolean }
):
  | { data: ParsedDealerApplication; error: null }
  | { data: null; error: string } {
  if (!body || typeof body !== "object") {
    return { data: null, error: "Invalid application payload" };
  }

  const candidate = body as Record<string, unknown>;

  const companyName = sanitizeText(candidate.companyName, LIMITS.companyName, true);
  const phoneRaw = sanitizeText(candidate.phone, LIMITS.phone, true);
  const emailRaw = sanitizeText(candidate.email, LIMITS.email, true);
  const password = typeof candidate.password === "string" ? candidate.password : "";
  const confirmPassword =
    typeof candidate.confirmPassword === "string" ? candidate.confirmPassword : "";

  if (!companyName || !phoneRaw || !emailRaw) {
    return { data: null, error: "Contact information is incomplete" };
  }

  const phone = normalizePhone(phoneRaw);
  const email = emailRaw.toLowerCase();

  if (!phone || !isValidEmail(email)) {
    return { data: null, error: "Valid email and phone number are required" };
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    return { data: null, error: passwordError };
  }

  if (password !== confirmPassword) {
    return { data: null, error: "Passwords do not match" };
  }

  const billing = parseAddressBlock(candidate.billing, true);

  if (!billing) {
    return { data: null, error: "Billing information is incomplete or invalid" };
  }

  const shippingSameAsBilling = candidate.shippingSameAsBilling === true;
  let shipping: DealerAddressInput;

  if (shippingSameAsBilling) {
    shipping = { ...billing };
  } else {
    const parsedShipping = parseAddressBlock(candidate.shipping, true);

    if (!parsedShipping) {
      return { data: null, error: "Shipping information is incomplete or invalid" };
    }

    shipping = parsedShipping;
  }

  const taxStatus = parseTaxStatus(candidate.taxStatus) ?? "taxable";

  const federalTaxIdRaw = sanitizeText(candidate.federalTaxId, LIMITS.federalTaxId, true);

  if (!federalTaxIdRaw) {
    return { data: null, error: "Federal Tax ID (EIN) is required" };
  }

  const federalTaxId = normalizeEin(federalTaxIdRaw);

  if (!federalTaxId) {
    return { data: null, error: "Enter a valid 9-digit Federal Tax ID (EIN)" };
  }

  let businessType: string | null = null;
  let expectedMonthlySales: string | null = null;
  let salesTaxAccount: string | null = null;
  let hasResaleLicense: boolean | null = null;
  let resaleLicenseNumber: string | null = null;

  if (taxStatus === "exempt") {
    const businessTypeRaw = sanitizeText(candidate.businessType, LIMITS.businessType, true);

    if (!businessTypeRaw || !BUSINESS_TYPE_OPTIONS.includes(businessTypeRaw as BusinessType)) {
      return { data: null, error: "Select a valid business type" };
    }

    businessType = businessTypeRaw;

    const expectedSalesRaw = sanitizeText(
      candidate.expectedMonthlySales,
      LIMITS.expectedMonthlySales,
      true
    );

    if (
      !expectedSalesRaw ||
      !EXPECTED_MONTHLY_SALES_OPTIONS.includes(expectedSalesRaw as ExpectedMonthlySales)
    ) {
      return { data: null, error: "Select expected monthly sales" };
    }

    expectedMonthlySales = expectedSalesRaw;

    const salesTaxAccountRaw = sanitizeText(
      candidate.salesTaxAccount,
      LIMITS.salesTaxAccount,
      true
    );

    if (!salesTaxAccountRaw) {
      return { data: null, error: "Sales Tax Account is required for tax-exempt applications" };
    }

    salesTaxAccount = salesTaxAccountRaw;

    hasResaleLicense = parseResaleLicense(candidate.hasResaleLicense);

    if (hasResaleLicense === null) {
      return { data: null, error: "Indicate whether you have a resale license" };
    }

    if (hasResaleLicense) {
      const resaleLicenseNumberRaw = sanitizeText(
        candidate.resaleLicenseNumber,
        LIMITS.resaleLicenseNumber,
        true
      );

      if (!resaleLicenseNumberRaw) {
        return { data: null, error: "Resale License Number is required" };
      }

      resaleLicenseNumber = resaleLicenseNumberRaw;
    }

    if (!options?.taxDocumentProvided) {
      return { data: null, error: "Upload a tax exemption document" };
    }
  }

  if (candidate.acceptedTerms !== true) {
    return { data: null, error: "You must accept the Terms and Conditions" };
  }

  const alternatePhoneRaw = sanitizeOptional(candidate.alternatePhone, LIMITS.phone);
  const alternatePhone = alternatePhoneRaw ? normalizePhone(alternatePhoneRaw) : null;
  const fax = sanitizeOptional(candidate.fax, LIMITS.fax);
  const applicationNotes = sanitizeOptional(candidate.notes, LIMITS.notes);

  return {
    data: {
      companyName,
      phone,
      alternatePhone,
      fax,
      email,
      password,
      billingFirstName: billing.firstName,
      billingLastName: billing.lastName,
      billingPhone: billing.phone,
      addressLine1: billing.addressLine1,
      addressLine2: billing.addressLine2 || null,
      city: billing.city,
      state: billing.state,
      postalCode: billing.postalCode,
      country: DEFAULT_COUNTRY,
      contactName: `${billing.firstName} ${billing.lastName}`.trim(),
      shippingSameAsBilling,
      shippingFirstName: shipping.firstName,
      shippingLastName: shipping.lastName,
      shippingAddressLine1: shipping.addressLine1,
      shippingAddressLine2: shipping.addressLine2 || null,
      shippingCity: shipping.city,
      shippingState: shipping.state,
      shippingPostalCode: shipping.postalCode,
      shippingCountry: DEFAULT_COUNTRY,
      shippingPhone: shipping.phone,
      taxStatus,
      federalTaxId,
      businessType,
      expectedMonthlySales,
      salesTaxAccount,
      hasResaleLicense,
      resaleLicenseNumber,
      taxDocumentUrl: null,
      applicationNotes,
    },
    error: null,
  };
}

export const DEALER_TERMS_TEXT =
  "In making this application and for and in consideration of any credit extended as a result of this application, the applicant and the undersigned, individually and collectively guaranty payment of all amounts which become due to Cabinetto Pro and promise to pay all costs of collection, including reasonable attorney fees incurred by Cabinetto Pro in collecting any money owed on any credit account maintained by any of the people or entities named in this application. If any account is established as a result of this application and is not paid when due the account shall bear interest at 1 ½% per month, 18% per annum. All payments for goods and merchandise purchased from Cabinetto Pro are due and payable at the offices of Cabinetto Pro. All merchandise purchased from Cabinetto Pro shall remain the property Cabinetto Pro until fully paid for. The terms are understood and will be complied with. The information herein is to be considered accurate to the best of my knowledge.";

export const DEALER_FORM_INPUT_CLASS =
  "w-full rounded-xl border border-slate-300/80 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition duration-200 focus:border-brand focus:ring-2 focus:ring-brand-ring dark:border-zinc-700/50 dark:bg-navy dark:text-cream";

export const DEALER_FORM_LABEL_CLASS = "block text-sm font-medium text-slate-600 dark:text-cream/85";

export const DEALER_FORM_GRID_CLASS = "grid gap-4 sm:grid-cols-2";

export const TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  taxable: "Taxable",
  exempt: "Exempt",
};
