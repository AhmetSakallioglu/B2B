"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCartStore } from "@/store/useCartStore";

type CartRemoveTarget = {
  id: string;
  name: string;
};

type CartRemoveConfirmContextValue = {
  requestRemoveItem: (item: CartRemoveTarget) => Promise<boolean>;
};

const CartRemoveConfirmContext = createContext<CartRemoveConfirmContextValue | null>(null);

export function CartRemoveConfirmProvider({ children }: { children: ReactNode }) {
  const removeItem = useCartStore((state) => state.removeItem);
  const [pendingItem, setPendingItem] = useState<CartRemoveTarget | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const finish = useCallback((confirmed: boolean) => {
    setPendingItem(null);
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
  }, []);

  const requestRemoveItem = useCallback((item: CartRemoveTarget) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPendingItem(item);
    });
  }, []);

  const handleConfirm = () => {
    if (pendingItem) {
      removeItem(pendingItem.id);
    }

    finish(true);
  };

  const handleCancel = () => {
    finish(false);
  };

  return (
    <CartRemoveConfirmContext.Provider value={{ requestRemoveItem }}>
      {children}
      <ConfirmDialog
        open={pendingItem !== null}
        title="Remove from cart?"
        description={
          pendingItem
            ? `Remove "${pendingItem.name}" from your cart? You can add it again from the catalog anytime.`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Keep in cart"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </CartRemoveConfirmContext.Provider>
  );
}

export function useCartRemoveConfirm() {
  const context = useContext(CartRemoveConfirmContext);

  if (!context) {
    throw new Error("useCartRemoveConfirm must be used within CartRemoveConfirmProvider");
  }

  return context;
}
