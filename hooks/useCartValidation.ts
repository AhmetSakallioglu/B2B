"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/useCartStore";

export function useCartValidation(enabled = true) {
  const items = useCartStore((state) => state.items);
  const isHydrated = useCartStore((state) => state.isHydrated);
  const setAvailability = useCartStore((state) => state.setAvailability);
  const hasUnavailableItems = useCartStore((state) => state.hasUnavailableItems());
  const removeUnavailableItems = useCartStore((state) => state.removeUnavailableItems);
  const isValidating = useCartStore((state) => state.isValidatingAvailability);

  useEffect(() => {
    if (!enabled || !isHydrated) {
      return;
    }

    if (items.length === 0) {
      setAvailability({});
      return;
    }

    const controller = new AbortController();

    async function validateCart() {
      useCartStore.setState({ isValidatingAvailability: true });

      try {
        const response = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantIds: items.map((item) => item.id) }),
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          availability?: Record<string, boolean>;
        };

        setAvailability(data.availability ?? {});
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      } finally {
        if (!controller.signal.aborted) {
          useCartStore.setState({ isValidatingAvailability: false });
        }
      }
    }

    void validateCart();

    return () => controller.abort();
  }, [enabled, isHydrated, items, setAvailability]);

  return {
    hasUnavailableItems,
    removeUnavailableItems,
    isValidating,
  };
}
