export type ShippingAddressRow = {
  id: string;
  user_id: number;
  address_title: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  contact_person: string | null;
  contact_phone: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ShippingAddress = {
  id: string;
  userId: number;
  addressTitle: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  contactPerson: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShippingAddressInput = {
  addressTitle: string;
  streetAddress: string;
  city: string;
  state?: string;
  zipCode: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
};

export type BillingAddressSnapshot = {
  addressTitle: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  contactPerson: string | null;
  contactPhone: string | null;
};

export type CheckoutShippingSelection =
  | { type: "billing" }
  | { type: "saved"; addressId: string }
  | {
      type: "new";
      address: ShippingAddressInput;
      saveForFuture?: boolean;
    };
