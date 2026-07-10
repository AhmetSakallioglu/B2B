import type { UserProfile } from "@/types/account";
import type { BillingAddressSnapshot } from "@/types/shipping-address";

export function billingAddressFromProfile(profile: UserProfile): BillingAddressSnapshot {
  return {
    addressTitle: profile.companyName || "Company address",
    streetAddress: profile.addressLine1,
    city: profile.city,
    state: profile.state || "TX",
    zipCode: profile.postalCode,
    contactPerson: profile.contactName || null,
    contactPhone: profile.phone || null,
  };
}
