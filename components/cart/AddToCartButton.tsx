"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, PlusIcon, ShoppingCartIcon } from "@/components/ui/Icon";
import { useCartStore, type CartItem } from "@/store/useCartStore";

type AddToCartButtonProps = {
  item: Omit<CartItem, "quantity">;
  quantity?: number;
  inCart?: boolean;
  isAdmin?: boolean;
  isOutOfStock?: boolean;
  adminLabel?: string;
  outOfStockLabel?: string;
  className?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  successDurationMs?: number;
};

const DEFAULT_SUCCESS_MS = 750;

export function AddToCartButton({
  item,
  quantity = 1,
  inCart = false,
  isAdmin = false,
  isOutOfStock = false,
  adminLabel = "Admin view",
  outOfStockLabel = "Out of Stock",
  className = "",
  size = "sm",
  fullWidth = true,
  successDurationMs = DEFAULT_SUCCESS_MS,
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [justAdded, setJustAdded] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disabled = isOutOfStock || isAdmin;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    if (disabled) {
      return;
    }

    addItem(item, quantity);
    setJustAdded(true);

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      setJustAdded(false);
    }, successDurationMs);
  };

  const sizeClasses =
    size === "md"
      ? `${fullWidth ? "w-full" : "flex-1 min-w-0"} px-5 py-3 text-sm font-semibold`
      : "px-4 py-2 text-sm font-medium";

  const iconSize = size === "md" ? 16 : 15;

  const addLabel =
    quantity > 1
      ? inCart
        ? `Add ${quantity} More`
        : `Add ${quantity} to Cart`
      : inCart
        ? size === "md"
          ? "Add More to Cart"
          : "Add More"
        : "Add to Cart";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full transition-all duration-200 enabled:hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 ${
        justAdded
          ? "scale-[1.02] bg-navy text-white shadow-md ring-2 ring-brand ring-offset-2 ring-offset-surface dark:ring-offset-navy"
          : "bg-brand text-white"
      } ${sizeClasses} ${className}`}
    >
      {justAdded ? (
        <>
          <CheckCircleIcon size={iconSize} className="animate-cart-check-pop" />
          Added
        </>
      ) : isAdmin ? (
        adminLabel
      ) : isOutOfStock ? (
        outOfStockLabel
      ) : (
        <>
          {inCart ? (
            <PlusIcon size={size === "md" ? 15 : 14} />
          ) : (
            <ShoppingCartIcon size={iconSize} />
          )}
          {addLabel}
        </>
      )}
    </button>
  );
}
