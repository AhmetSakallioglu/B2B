"use client";

import { useEffect, useRef } from "react";
import {
  clearGuestCart,
  guestCartItemsForMerge,
  loadGuestCart,
  saveGuestCart,
} from "@/lib/guest-cart";
import { useCartStore } from "@/store/useCartStore";
import type { SessionUser } from "@/types/auth";

const SYNC_DELAY_MS = 400;

function getAuthKey(currentUser: SessionUser | null, isAdmin: boolean) {
  if (isAdmin) {
    return "admin";
  }

  return currentUser ? `user:${currentUser.id}` : "guest";
}

export function useCartPersistence(
  currentUser: SessionUser | null,
  isAdmin: boolean,
  sessionLoading = false
) {
  const items = useCartStore((state) => state.items);
  const isHydrated = useCartStore((state) => state.isHydrated);
  const setItems = useCartStore((state) => state.setItems);
  const setHydrated = useCartStore((state) => state.setHydrated);
  const syncTimerRef = useRef<number | null>(null);
  const skipNextSyncRef = useRef(false);
  const hydratedAuthKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    const authKey = getAuthKey(currentUser, isAdmin);

    if (hydratedAuthKeyRef.current === authKey && isHydrated) {
      return;
    }

    let cancelled = false;

    async function hydrateCart() {
      if (isAdmin) {
        setItems([]);
        setHydrated(true);
        hydratedAuthKeyRef.current = authKey;
        return;
      }

      if (currentUser) {
        try {
          const guestItems = loadGuestCart();
          const response = await fetch("/api/cart");

          if (response.ok) {
            const data = (await response.json()) as {
              items: Array<{ id: string; name: string; price: number; quantity: number }>;
            };

            if (!cancelled) {
              if (guestItems.length > 0) {
                await fetch("/api/cart", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    merge: true,
                    items: guestCartItemsForMerge(guestItems),
                  }),
                });
                clearGuestCart();

                const refreshed = await fetch("/api/cart");
                if (refreshed.ok) {
                  const merged = (await refreshed.json()) as {
                    items: Array<{ id: string; name: string; price: number; quantity: number }>;
                  };
                  skipNextSyncRef.current = true;
                  setItems(merged.items);
                } else {
                  skipNextSyncRef.current = true;
                  setItems(data.items);
                }
              } else {
                skipNextSyncRef.current = true;
                setItems(data.items);
              }
            }
          }
        } catch {
          if (!cancelled) {
            setItems(loadGuestCart());
          }
        } finally {
          if (!cancelled) {
            setHydrated(true);
            hydratedAuthKeyRef.current = authKey;
          }
        }
        return;
      }

      skipNextSyncRef.current = true;
      clearGuestCart();
      setItems([]);
      setHydrated(true);
      hydratedAuthKeyRef.current = authKey;
    }

    hydrateCart();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isAdmin, isHydrated, sessionLoading, setHydrated, setItems]);

  useEffect(() => {
    if (sessionLoading || !isHydrated || isAdmin) {
      return;
    }

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = window.setTimeout(async () => {
      if (currentUser) {
        try {
          await fetch("/api/cart", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
        } catch {
          // Keep local cart if sync fails temporarily.
        }
        return;
      }

      saveGuestCart(items);
    }, SYNC_DELAY_MS);

    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, [currentUser, isAdmin, isHydrated, items, sessionLoading]);
}
