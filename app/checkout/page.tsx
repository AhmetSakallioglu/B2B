"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CustomerAccountNav } from "@/components/account/CustomerAccountNav";
import { CartItemsList, CartTotals } from "@/components/cart/CartItemsList";
import { CartUnavailableNotice } from "@/components/cart/CartUnavailableNotice";
import { PromoCodeField } from "@/components/cart/PromoCodeField";
import {
  resolveZipFromSelection,
  ShippingAddressPanel,
  shippingSelectionToCheckoutPayload,
  type ShippingSelectionState,
} from "@/components/checkout/ShippingAddressPanel";
import { useSession } from "@/components/auth/SessionProvider";
import {
  CheckCircleIcon,
  CreditCardIcon,
  ArrowLeftIcon,
  ShoppingCartIcon,
} from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LoadingState } from "@/components/ui/LoadingState";
import { useCartPersistence } from "@/hooks/useCartPersistence";
import { useCartValidation } from "@/hooks/useCartValidation";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { toCheckoutLineItems } from "@/lib/cart-checkout";
import {
  isProfileCompleteForOrdering,
  ORDER_PROFILE_INCOMPLETE_MESSAGE,
} from "@/lib/user-profile";
import type { ServerCartPricingResult } from "@/lib/server-cart-pricing";
import { normalizeShippingZip } from "@/lib/shipping-zip";
import { ui } from "@/lib/ui-classes";
import type { UserProfile } from "@/types/account";
import type { CreateOrderRequest } from "@/types/checkout";
import type { ShippingAddress } from "@/types/shipping-address";
import { useCartStore } from "@/store/useCartStore";

function CheckoutPageContent() {
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([]);
  const [shippingSelection, setShippingSelection] = useState<ShippingSelectionState | null>({
    kind: "billing",
  });
  const [checkoutPricing, setCheckoutPricing] = useState<ServerCartPricingResult | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useCartStore((state) => state.items);
  const isHydrated = useCartStore((state) => state.isHydrated);
  const clearCart = useCartStore((state) => state.clearCart);
  const appliedPromo = useCartStore((state) => state.appliedPromo);
  const setAppliedPromo = useCartStore((state) => state.setAppliedPromo);

  useCartPersistence(user, user?.role === "admin", sessionLoading);
  const { hasUnavailableItems, isValidating } = useCartValidation(user?.role !== "admin");

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent("/checkout")}`);
      return;
    }

    if (user.role === "admin") {
      router.replace("/admin");
    }
  }, [router, sessionLoading, user]);

  const loadCheckoutData = useCallback(async () => {
    if (!user || user.role === "admin") {
      return;
    }

    try {
      const [profileResponse, addressesResponse] = await Promise.all([
        fetch("/api/account/profile"),
        fetch("/api/account/shipping-addresses"),
      ]);

      if (!profileResponse.ok) {
        throw new Error("Failed to load account profile");
      }

      const profileData = (await profileResponse.json()) as { profile: UserProfile };
      setProfile(profileData.profile);

      if (addressesResponse.ok) {
        const addressesData = (await addressesResponse.json()) as {
          addresses: ShippingAddress[];
        };
        setSavedAddresses(addressesData.addresses);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load checkout data");
    }
  }, [user]);

  useDeferredEffect(() => {
    void loadCheckoutData();
  }, [loadCheckoutData]);

  useEffect(() => {
    if (isHydrated && items.length === 0) {
      router.replace("/cart");
    }
  }, [isHydrated, items.length, router]);

  const refreshCheckoutPricing = useCallback(async () => {
    if (!user || items.length === 0 || !profile) {
      setCheckoutPricing(null);
      return;
    }

    const zipCode = await resolveZipFromSelection(profile, savedAddresses, shippingSelection);
    const normalizedZip = zipCode ? normalizeShippingZip(zipCode) : null;

    if (!normalizedZip) {
      setCheckoutPricing(null);
      return;
    }

    setIsPricingLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipCode: normalizedZip,
          items: toCheckoutLineItems(items),
          promoCode: appliedPromo?.code ?? null,
        }),
      });

      const data = (await response.json()) as {
        pricing?: ServerCartPricingResult;
        error?: string;
      };

      if (!response.ok) {
        setCheckoutPricing(null);
        setError(data.error ?? "Failed to calculate shipping");
        return;
      }

      setCheckoutPricing(data.pricing ?? null);
    } catch {
      setCheckoutPricing(null);
      setError("Failed to calculate shipping");
    } finally {
      setIsPricingLoading(false);
    }
  }, [appliedPromo?.code, items, profile, savedAddresses, shippingSelection, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshCheckoutPricing();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [refreshCheckoutPricing]);

  const submitOrder = async () => {
    if (!shippingSelection || !reviewConfirmed || isSubmittingOrder || items.length === 0) {
      return;
    }

    setIsSubmittingOrder(true);
    setError(null);

    try {
      if (!profile || !isProfileCompleteForOrdering(profile)) {
        setError(ORDER_PROFILE_INCOMPLETE_MESSAGE);
        router.push("/account?complete=1");
        return;
      }

      const orderPayload: CreateOrderRequest = {
        items: toCheckoutLineItems(items),
        promoCode: appliedPromo?.code ?? null,
        shipping: shippingSelectionToCheckoutPayload(shippingSelection),
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = (await response.json()) as { orderId?: number; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to place order");
      }

      clearCart();
      setAppliedPromo(null);
      router.push(`/orders?placed=1&order=${data.orderId}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to place order"
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const canPlaceOrder =
    items.length > 0 &&
    reviewConfirmed &&
    !isSubmittingOrder &&
    !hasUnavailableItems &&
    !isValidating &&
    Boolean(checkoutPricing) &&
    !isPricingLoading &&
    Boolean(shippingSelection);

  if (sessionLoading || !isHydrated || !profile) {
    return <LoadingState fullScreen label="Loading checkout..." spinnerSize="lg" />;
  }

  return (
    <div className={ui.catalogPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainerNarrow} py-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={ui.eyebrow}>Checkout</p>
              <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
                <ShoppingCartIcon size={26} className="text-brand" />
                Complete your order
              </h1>
              <p className={`mt-1.5 ${ui.bodyMuted}`}>
                Select a delivery site and review your final total.
              </p>
            </div>
            <Link href="/cart" className={ui.btnSecondary}>
              <IconLabel icon={<ArrowLeftIcon size={15} />}>Back to cart</IconLabel>
            </Link>
          </div>

          <div className="mt-5">
            <CustomerAccountNav active="cart" />
          </div>
        </div>
      </header>

      <main className={`${ui.pageContainerNarrow} grid gap-6 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]`}>
        <section className={`space-y-6 p-6 ${ui.catalogCard}`}>
          <ShippingAddressPanel
            profile={profile}
            savedAddresses={savedAddresses}
            selection={shippingSelection}
            onSelectionChange={setShippingSelection}
          />

          <div>
            <h3 className={ui.heading3}>Order items</h3>
            <div className="mt-4">
              <CartItemsList compact />
            </div>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className={`p-6 ${ui.catalogCard}`}>
            <h2 className={`flex items-center gap-2 ${ui.heading3}`}>
              <CreditCardIcon size={20} className="text-brand" />
              Order summary
            </h2>

            <div className="mt-6 space-y-4">
              <CartTotals
                mode="checkout"
                pricing={checkoutPricing}
                isLoading={isPricingLoading}
                hasShippingSelection={Boolean(shippingSelection)}
              />

              <PromoCodeField
                disabled={isSubmittingOrder}
                onError={(message) => setError(message)}
              />

              {hasUnavailableItems && (
                <CartUnavailableNotice onCleared={() => setReviewConfirmed(false)} />
              )}

              <label className={`flex items-start gap-3 px-4 py-3 text-sm ${ui.cardMuted}`}>
                <input
                  type="checkbox"
                  checked={reviewConfirmed}
                  onChange={(event) => setReviewConfirmed(event.target.checked)}
                  className="mt-0.5 accent-brand"
                />
                <span className="text-slate-700 dark:text-cream/90">
                  I confirm the shipping address, items, and final total are correct.
                </span>
              </label>

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={!canPlaceOrder}
                onClick={() => void submitOrder()}
                className={`${ui.btnPrimary} w-full`}
              >
                {isSubmittingOrder ? (
                  <>
                    <LoadingSpinner size="sm" variant="light" />
                    Placing order...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon size={16} />
                    Place Order
                  </>
                )}
              </button>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingState fullScreen label="Loading checkout..." spinnerSize="lg" />}>
      <CheckoutPageContent />
    </Suspense>
  );
}
