import type { CheckoutLineItem } from "@/types/checkout";
import type { OrderCartItem } from "@/types/catalog";

export function toCheckoutLineItems(
  items: Pick<OrderCartItem, "id" | "quantity">[]
): CheckoutLineItem[] {
  return items.map((item) => ({
    variantId: item.id,
    quantity: item.quantity,
  }));
}
