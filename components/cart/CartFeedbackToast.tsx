"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircleIcon, ShoppingCartIcon, TrashIcon } from "@/components/ui/Icon";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { stripCartItemDimensions } from "@/lib/format-dimensions";
import { ui } from "@/lib/ui-classes";
import { useCartStore, type CartFeedback } from "@/store/useCartStore";

export function CartFeedbackToast() {
  const lastFeedback = useCartStore((state) => state.lastFeedback);
  const totalItems = useCartStore((state) => state.totalItems());
  const [toast, setToast] = useState<CartFeedback | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useDeferredEffect(() => {
    if (!lastFeedback) {
      return;
    }

    setToast(lastFeedback);
    setIsLeaving(false);

    const leaveTimer = setTimeout(() => setIsLeaving(true), 2600);
    const hideTimer = setTimeout(() => setToast(null), 3000);

    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(hideTimer);
    };
  }, [lastFeedback?.at]);

  if (!toast) {
    return null;
  }

  const displayName = stripCartItemDimensions(toast.name);
  const isAdd = toast.type === "add";

  const title = isAdd
    ? toast.quantity > 1
      ? `${toast.quantity}× added to cart`
      : "Added to cart"
    : toast.quantity > 1
      ? `${toast.quantity}× removed from cart`
      : "Removed from cart";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-4 z-50 max-w-sm sm:right-6 ${
        isLeaving ? "animate-cart-toast-out" : "animate-cart-toast-in"
      }`}
    >
      <div className={`flex items-start gap-3 p-4 shadow-lg ${ui.catalogCard}`}>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isAdd
              ? "bg-brand-light text-brand"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {isAdd ? <CheckCircleIcon size={22} /> : <TrashIcon size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-cream">{title}</p>
          <p className={`mt-0.5 truncate text-sm ${ui.bodyMuted}`}>{displayName}</p>
          {totalItems > 0 ? (
            <Link
              href="/cart"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand transition hover:text-brand-hover"
            >
              <ShoppingCartIcon size={14} />
              View cart ({totalItems})
            </Link>
          ) : (
            <Link
              href="/catalog"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand transition hover:text-brand-hover"
            >
              Browse catalog
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
