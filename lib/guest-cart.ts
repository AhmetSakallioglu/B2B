import type { OrderCartItem } from "@/types/catalog";

const GUEST_CART_KEY = "cabinet_guest_cart";
const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type StoredGuestCart = {
  items: OrderCartItem[];
  expiresAt: number;
};

export function loadGuestCart(): OrderCartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredGuestCart;

    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(GUEST_CART_KEY);
      return [];
    }

    if (!Array.isArray(parsed.items)) {
      return [];
    }

    return parsed.items.filter(
      (item) =>
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.price === "number" &&
        typeof item.quantity === "number" &&
        item.quantity > 0
    );
  } catch {
    return [];
  }
}

export function saveGuestCart(items: OrderCartItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  if (items.length === 0) {
    window.localStorage.removeItem(GUEST_CART_KEY);
    return;
  }

  const payload: StoredGuestCart = {
    items,
    expiresAt: Date.now() + GUEST_CART_TTL_MS,
  };

  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(payload));
}

export function clearGuestCart() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(GUEST_CART_KEY);
}

export function guestCartItemsForMerge(items: OrderCartItem[]) {
  return items
    .map((item) => ({
      variantId: Number.parseInt(item.id, 10),
      quantity: item.quantity,
    }))
    .filter((item) => Number.isInteger(item.variantId) && item.variantId > 0);
}
