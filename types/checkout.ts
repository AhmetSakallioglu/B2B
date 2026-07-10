import type { CheckoutShippingSelection } from "@/types/shipping-address";

export type CheckoutLineItem = {
  variantId: string;
  quantity: number;
};

export type CreateOrderRequest = {
  items: CheckoutLineItem[];
  promoCode?: string | null;
  shippingPostalCode?: string | null;
  shippingAddressId?: string | null;
  shipping?: CheckoutShippingSelection;
};
