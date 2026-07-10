import { roundQuoteTotal } from "@/lib/cart-items";
import { getVariantAvailabilityMap } from "@/lib/cart-validation";
import { resolveServerCartPricing } from "@/lib/server-cart-pricing";
import type { OrderCartItem } from "@/types/catalog";
import type { QuotePriceChangedItem, QuotePriceFreshness } from "@/types/quotes";
import type { UserRole } from "@/types/auth";

export async function checkQuotePriceFreshness(params: {
  savedItems: OrderCartItem[];
  savedTotalAmount: number;
  userId: number;
  userRole: UserRole;
}): Promise<QuotePriceFreshness> {
  const cartLines = params.savedItems.map((item) => ({
    variantId: item.id,
    quantity: item.quantity,
  }));

  const pricing = await resolveServerCartPricing({
    items: cartLines,
    userId: params.userId,
    userRole: params.userRole,
    requireAvailability: false,
  });

  if ("error" in pricing) {
    return {
      priceChanged: false,
      oldTotalAmount: params.savedTotalAmount,
      newTotalAmount: params.savedTotalAmount,
      changedItems: [],
      updatedItems: params.savedItems,
    };
  }

  const variantIds = params.savedItems.map((item) => Number.parseInt(item.id, 10));
  const availability = await getVariantAvailabilityMap(variantIds);
  const pricedById = new Map(pricing.items.map((item) => [item.id, item]));

  const changedItems: QuotePriceChangedItem[] = [];

  for (const savedItem of params.savedItems) {
    const variantId = savedItem.id;
    const numericId = Number.parseInt(variantId, 10);
    const isAvailable = availability.get(numericId) === true;
    const currentItem = pricedById.get(variantId);
    const currentPrice = currentItem?.price ?? null;

    if (!isAvailable) {
      changedItems.push({
        variantId,
        oldPrice: savedItem.price,
        newPrice: currentPrice,
        outOfStock: true,
      });
      continue;
    }

    if (currentPrice !== null && currentPrice !== savedItem.price) {
      changedItems.push({
        variantId,
        oldPrice: savedItem.price,
        newPrice: currentPrice,
      });
    }
  }

  const priceChanged = changedItems.length > 0;

  return {
    priceChanged,
    oldTotalAmount: roundQuoteTotal(params.savedTotalAmount),
    newTotalAmount: pricing.totalAmount,
    changedItems,
    updatedItems: pricing.items,
  };
}
