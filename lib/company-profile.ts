export type CompanyProfile = {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  addressLine1: string;
  cityLine: string;
};

/**
 * Reads company branding from environment variables.
 * Use static `process.env.NEXT_PUBLIC_*` access so Next.js can inline values in client bundles.
 * Configure in `.env.local` — see README optional env section.
 */
export function getCompanyProfile(): CompanyProfile {
  return {
    name: process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() ?? "",
    tagline: process.env.NEXT_PUBLIC_COMPANY_TAGLINE?.trim() ?? "",
    email: process.env.NEXT_PUBLIC_COMPANY_EMAIL?.trim() ?? "",
    phone: process.env.NEXT_PUBLIC_COMPANY_PHONE?.trim() ?? "",
    addressLine1: process.env.NEXT_PUBLIC_COMPANY_ADDRESS_LINE1?.trim() ?? "",
    cityLine: process.env.NEXT_PUBLIC_COMPANY_CITY_LINE?.trim() ?? "",
  };
}

export function isCompanyProfileConfigured(profile: CompanyProfile) {
  return Boolean(
    profile.name &&
      profile.addressLine1 &&
      profile.cityLine &&
      (profile.email || profile.phone)
  );
}
