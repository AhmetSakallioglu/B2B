import { create } from "zustand";
import type { OrderCartItem } from "@/types/catalog";
import type { QuotePriceChangedItem } from "@/types/quotes";
import type { AppliedPromoSummary } from "@/types/promo-code";

export type CartItem = OrderCartItem;

export type CartFeedback = {
  type: "add" | "remove";
  name: string;
  quantity: number;
  at: number;
};

export type QuotePriceChangeNotice = {
  oldTotalAmount: number;
  newTotalAmount: number;
  changedItems: QuotePriceChangedItem[];
};

const SOURCE_QUOTE_STORAGE_KEY = "cabinet-source-quote-id";

function readStoredSourceQuoteId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const parsed = Number.parseInt(sessionStorage.getItem(SOURCE_QUOTE_STORAGE_KEY) ?? "", 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSourceQuoteId(quoteId: number | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (quoteId) {
      sessionStorage.setItem(SOURCE_QUOTE_STORAGE_KEY, String(quoteId));
    } else {
      sessionStorage.removeItem(SOURCE_QUOTE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

type CartState = {
  items: CartItem[];
  isHydrated: boolean;
  lastFeedback: CartFeedback | null;
  availability: Record<string, boolean>;
  isValidatingAvailability: boolean;
  quotePriceChangeNotice: QuotePriceChangeNotice | null;
  appliedPromo: AppliedPromoSummary | null;
  sourceQuoteId: number | null;
  setItems: (items: CartItem[]) => void;
  setHydrated: (value: boolean) => void;
  setAvailability: (availability: Record<string, boolean>) => void;
  setQuotePriceChangeNotice: (notice: QuotePriceChangeNotice | null) => void;
  setAppliedPromo: (promo: AppliedPromoSummary | null) => void;
  setSourceQuoteId: (quoteId: number | null) => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  removeUnavailableItems: () => void;
  isItemAvailable: (id: string) => boolean;
  hasUnavailableItems: () => boolean;
  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isHydrated: false,
  lastFeedback: null,
  availability: {},
  isValidatingAvailability: false,
  quotePriceChangeNotice: null,
  appliedPromo: null,
  sourceQuoteId: readStoredSourceQuoteId(),

  setItems: (items) =>
    set((state) => {
      const sourceQuoteId = items.length === 0 ? null : state.sourceQuoteId;

      if (sourceQuoteId === null) {
        writeStoredSourceQuoteId(null);
      }

      return { items, availability: {}, appliedPromo: null, sourceQuoteId };
    }),
  setHydrated: (value) => set({ isHydrated: value }),
  setAvailability: (availability) => set({ availability }),
  setQuotePriceChangeNotice: (notice) => set({ quotePriceChangeNotice: notice }),
  setAppliedPromo: (promo) => set({ appliedPromo: promo }),
  setSourceQuoteId: (quoteId) => {
    writeStoredSourceQuoteId(quoteId);
    set({ sourceQuoteId: quoteId });
  },

  addItem: (item, quantity = 1) => {
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);

      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id
              ? { ...i, quantity: i.quantity + quantity }
              : i
          ),
          appliedPromo: null,
          lastFeedback: {
            type: "add",
            name: item.name,
            quantity,
            at: Date.now(),
          },
        };
      }

      return {
        items: [...state.items, { ...item, quantity }],
        appliedPromo: null,
        lastFeedback: {
          type: "add",
          name: item.name,
          quantity,
          at: Date.now(),
        },
      };
    });
  },

  removeItem: (id) => {
    set((state) => {
      const removed = state.items.find((item) => item.id === id);

      if (!removed) {
        return state;
      }

      const items = state.items.filter((item) => item.id !== id);
      const sourceQuoteId = items.length === 0 ? null : state.sourceQuoteId;

      if (sourceQuoteId === null) {
        writeStoredSourceQuoteId(null);
      }

      return {
        items,
        appliedPromo: null,
        sourceQuoteId,
        lastFeedback: {
          type: "remove",
          name: removed.name,
          quantity: removed.quantity,
          at: Date.now(),
        },
      };
    });
  },

  updateQuantity: (id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, quantity } : item
      ),
      appliedPromo: null,
    }));
  },

  clearCart: () => {
    writeStoredSourceQuoteId(null);
    set({
      items: [],
      availability: {},
      quotePriceChangeNotice: null,
      appliedPromo: null,
      sourceQuoteId: null,
    });
  },

  removeUnavailableItems: () => {
    set((state) => {
      const nextItems = state.items.filter(
        (item) => state.availability[item.id] !== false
      );

      const nextAvailability: Record<string, boolean> = {};
      for (const item of nextItems) {
        if (state.availability[item.id] === true) {
          nextAvailability[item.id] = true;
        }
      }

      return {
        items: nextItems,
        availability: nextAvailability,
      };
    });
  },

  isItemAvailable: (id) => get().availability[id] !== false,

  hasUnavailableItems: () =>
    get().items.some((item) => get().availability[item.id] === false),

  totalItems: () =>
    get().items.reduce((total, item) => total + item.quantity, 0),

  totalPrice: () =>
    get().items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    ),
}));
