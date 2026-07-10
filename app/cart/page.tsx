"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CustomerAccountNav } from "@/components/account/CustomerAccountNav";
import { useSession } from "@/components/auth/SessionProvider";
import { CartItemsList, CartTotals } from "@/components/cart/CartItemsList";
import { CartUnavailableNotice } from "@/components/cart/CartUnavailableNotice";
import { PromoCodeField } from "@/components/cart/PromoCodeField";
import { QuotePriceChangeBanner } from "@/components/quotes/QuotePriceChangeBanner";
import { GenerateClientQuoteModal } from "@/components/quotes/GenerateClientQuoteModal";
import { SaveQuoteModal } from "@/components/quotes/SaveQuoteModal";
import { SaveRoomTemplateModal } from "@/components/room-templates/SaveRoomTemplateModal";
import {
  CheckCircleIcon,
  ClipboardListIcon,
  ExternalLinkIcon,
  GridIcon,
  LogInIcon,
  PaletteIcon,
  ShoppingCartIcon,
  StoreIcon,
  TrashIcon,
} from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { LoadingState } from "@/components/ui/LoadingState";
import { useCartPersistence } from "@/hooks/useCartPersistence";
import { useCartValidation } from "@/hooks/useCartValidation";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import {
  isProfileCompleteForOrdering,
  ORDER_PROFILE_INCOMPLETE_MESSAGE,
} from "@/lib/user-profile";
import { toCheckoutLineItems } from "@/lib/cart-checkout";
import { ui } from "@/lib/ui-classes";
import type { UserProfile } from "@/types/account";
import type { QuoteSaveRequest } from "@/types/quotes";
import { useCartStore } from "@/store/useCartStore";

function CartPageContent() {
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useSession();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [isSavingRoomTemplate, setIsSavingRoomTemplate] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [roomTemplateModalOpen, setRoomTemplateModalOpen] = useState(false);
  const [clientQuoteModalOpen, setClientQuoteModalOpen] = useState(false);
  const [isGeneratingClientQuote, setIsGeneratingClientQuote] = useState(false);
  const [quoteBranding, setQuoteBranding] = useState<{
    companyLogoUrl: string | null;
    customQuoteFooterText: string | null;
    postalCode: string;
  } | null>(null);
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useCartStore((state) => state.items);
  const isHydrated = useCartStore((state) => state.isHydrated);
  const clearCart = useCartStore((state) => state.clearCart);
  const quotePriceChangeNotice = useCartStore((state) => state.quotePriceChangeNotice);
  const setQuotePriceChangeNotice = useCartStore((state) => state.setQuotePriceChangeNotice);
  const appliedPromo = useCartStore((state) => state.appliedPromo);

  useCartPersistence(user, user?.role === "admin", sessionLoading);
  const { hasUnavailableItems, isValidating } = useCartValidation(user?.role !== "admin");

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (user?.role === "admin") {
      router.replace("/admin");
    }
  }, [router, sessionLoading, user]);

  const loadProfileCompleteness = useCallback(async () => {
    if (!user || user.role === "admin") {
      setIsProfileComplete(null);
      return true;
    }

    try {
      const response = await fetch("/api/account/profile");

      if (!response.ok) {
        setIsProfileComplete(false);
        return false;
      }

      const data = (await response.json()) as { profile: UserProfile };
      const complete = isProfileCompleteForOrdering(data.profile);
      setIsProfileComplete(complete);
      return complete;
    } catch {
      setIsProfileComplete(false);
      return false;
    }
  }, [user]);

  useDeferredEffect(() => {
    void loadProfileCompleteness();
  }, [loadProfileCompleteness]);

  const loadQuoteBranding = useCallback(async () => {
    if (!user || user.role === "admin") {
      setQuoteBranding(null);
      return;
    }

    try {
      const response = await fetch("/api/account/quote-branding");

      if (!response.ok) {
        setQuoteBranding(null);
        return;
      }

      const data = (await response.json()) as {
        branding: {
          companyLogoUrl: string | null;
          customQuoteFooterText: string | null;
          postalCode: string;
        };
      };

      setQuoteBranding(data.branding);
    } catch {
      setQuoteBranding(null);
    }
  }, [user]);

  useDeferredEffect(() => {
    void loadQuoteBranding();
  }, [loadQuoteBranding]);

  const generateClientQuote = async (formData: FormData) => {
    if (items.length === 0 || isGeneratingClientQuote) {
      return;
    }

    setIsGeneratingClientQuote(true);
    setError(null);
    setQuoteMessage(null);

    try {
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent("/cart")}`);
        return;
      }

      const response = await fetch("/api/quotes/generate-client-pdf", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        let message = "Failed to generate client quote";

        if (contentType.includes("application/json")) {
          const data = (await response.json()) as { error?: string };
          message = data.error ?? message;
        } else {
          message = `${message} (HTTP ${response.status})`;
        }

        throw new Error(message);
      }

      if (!contentType.includes("application/pdf")) {
        throw new Error("Unexpected response from quote generator. Please try again.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "client-quote.pdf";
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);

      setQuoteMessage("Client quote PDF downloaded. Your dealer branding was applied.");
      setClientQuoteModalOpen(false);
      void loadQuoteBranding();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate client quote"
      );
    } finally {
      setIsGeneratingClientQuote(false);
    }
  };

  const saveQuote = async (quoteName: string) => {
    if (items.length === 0 || isSavingQuote) {
      return;
    }

    setIsSavingQuote(true);
    setError(null);
    setQuoteMessage(null);

    try {
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent("/cart")}`);
        return;
      }

      const quotePayload: QuoteSaveRequest = {
        quoteName,
        items: toCheckoutLineItems(items),
      };

      const response = await fetch("/api/quotes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotePayload),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save quote");
      }

      setQuoteMessage(`Quote "${quoteName}" saved. View it under My Quotes.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save quote");
    } finally {
      setIsSavingQuote(false);
      setQuoteModalOpen(false);
    }
  };

  const saveRoomTemplate = async (templateName: string) => {
    if (items.length === 0 || isSavingRoomTemplate) {
      return;
    }

    setIsSavingRoomTemplate(true);
    setError(null);
    setQuoteMessage(null);

    try {
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent("/cart")}`);
        return;
      }

      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName,
          items: toCheckoutLineItems(items),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save room template");
      }

      setQuoteMessage(
        `Room template "${templateName}" saved. Manage it under My Room Templates.`
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save room template"
      );
    } finally {
      setIsSavingRoomTemplate(false);
      setRoomTemplateModalOpen(false);
    }
  };

  const needsProfileForOrder =
    Boolean(user) && user?.role !== "admin" && isProfileComplete === false;

  const canProceedToCheckout =
    items.length > 0 &&
    Boolean(user) &&
    !needsProfileForOrder &&
    !hasUnavailableItems &&
    !isValidating;

  const canSaveQuote =
    items.length > 0 && Boolean(user) && !isSavingQuote && !isSavingRoomTemplate;
  const canSaveRoomTemplate =
    items.length > 0 && Boolean(user) && !isSavingRoomTemplate && !isSavingQuote;
  const canGenerateClientQuote =
    items.length > 0 &&
    Boolean(user) &&
    !isGeneratingClientQuote &&
    !isSavingQuote &&
    !isSavingRoomTemplate;

  if (sessionLoading || !isHydrated) {
    return <LoadingState fullScreen label="Loading your cart..." spinnerSize="lg" />;
  }

  return (
    <div className={ui.catalogPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainerNarrow} py-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={ui.eyebrow}>Cart</p>
              <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
                <ShoppingCartIcon size={26} className="text-brand" />
                Review your cart
              </h1>
              <p className={`mt-1.5 ${ui.bodyMuted}`}>
                Check quantities and promo codes before checkout.
              </p>
            </div>
            <Link href="/" className={ui.btnSecondary}>
              <IconLabel icon={<StoreIcon size={15} />}>Continue shopping</IconLabel>
            </Link>
          </div>

          {user && (
            <div className="mt-5">
              <CustomerAccountNav active="cart" />
            </div>
          )}
        </div>
      </header>

      {quotePriceChangeNotice && (
        <div className={`${ui.pageContainerNarrow} pt-6`}>
          <QuotePriceChangeBanner
            oldTotalAmount={quotePriceChangeNotice.oldTotalAmount}
            newTotalAmount={quotePriceChangeNotice.newTotalAmount}
            changedItems={quotePriceChangeNotice.changedItems}
            onDismiss={() => setQuotePriceChangeNotice(null)}
          />
        </div>
      )}

      <main className={`${ui.pageContainerNarrow} grid gap-6 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]`}>
        <section className={`p-6 ${ui.catalogCard}`}>
          <h2 className={ui.heading3}>Cart items</h2>
          <p className={`mt-1 ${ui.bodyMuted}`}>
            Adjust quantities here before proceeding to checkout.
          </p>

          <div className="mt-6">
            {items.length === 0 ? (
              <div className={`px-6 py-12 text-center ${ui.emptyState}`}>
                <ShoppingCartIcon size={40} className="mx-auto text-slate-300" />
                <p className="mt-4 text-base font-semibold text-slate-900 dark:text-cream">
                  Your cart is empty
                </p>
                <p className={`mt-2 ${ui.bodyMuted}`}>
                  Browse the catalog and add cabinets to your cart first.
                </p>
                <Link href="/" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
                  <PaletteIcon size={15} />
                  Choose a finish
                </Link>
              </div>
            ) : (
              <CartItemsList />
            )}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className={`p-6 ${ui.catalogCard}`}>
            <h2 className={`flex items-center gap-2 ${ui.heading3}`}>
              <ShoppingCartIcon size={20} className="text-brand" />
              Cart summary
            </h2>

            <div className="mt-6 space-y-4">
              <CartTotals mode="cart" appliedPromo={appliedPromo} />

              {user && items.length > 0 && (
                <PromoCodeField disabled={isSavingQuote} onError={(message) => setError(message)} />
              )}

              {!user && items.length > 0 && (
                <div className={`px-4 py-3 text-sm ${ui.cardMuted}`}>
                  <Link
                    href={`/login?redirect=${encodeURIComponent("/cart")}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-brand underline underline-offset-2"
                  >
                    <LogInIcon size={14} />
                    Log in
                  </Link>{" "}
                  to save quotes or proceed to checkout. Your cart is saved on this device.
                </div>
              )}

              {needsProfileForOrder && (
                <div className="rounded-xl border border-brand/30 bg-brand-light/40 px-4 py-3 text-sm text-slate-900 dark:border-brand/30 dark:bg-brand-light/20 dark:text-cream">
                  <p>{ORDER_PROFILE_INCOMPLETE_MESSAGE}</p>
                  <Link
                    href="/account?complete=1"
                    className="mt-2 inline-flex font-semibold text-brand underline underline-offset-2"
                  >
                    Complete My Account
                  </Link>
                </div>
              )}

              {hasUnavailableItems && <CartUnavailableNotice />}

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </p>
              )}

              {quoteMessage && (
                <p className={`px-4 py-3 text-sm ${ui.cardMuted}`}>
                  {quoteMessage}
                  {quoteMessage.startsWith('Quote "') && (
                    <>
                      {" "}
                      <Link href="/account/quotes" className="font-semibold text-brand underline">
                        My Quotes
                      </Link>
                    </>
                  )}
                  {quoteMessage.startsWith('Room template "') && (
                    <>
                      {" "}
                      <Link
                        href="/account/room-templates"
                        className="font-semibold text-brand underline"
                      >
                        My Room Templates
                      </Link>
                    </>
                  )}
                </p>
              )}

              <div className="space-y-2.5">
                {user && items.length > 0 && (
                  <>
                    <p className="px-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-cream/55">
                      Save & export
                    </p>
                    <button
                      type="button"
                      disabled={!canSaveRoomTemplate}
                      onClick={() => {
                        setError(null);
                        setRoomTemplateModalOpen(true);
                      }}
                      className={`${ui.btnOutlineBrand} w-full py-3`}
                    >
                      <GridIcon size={16} />
                      Save Cart as Room Template
                    </button>

                    <button
                      type="button"
                      disabled={!canSaveQuote}
                      onClick={() => {
                        setError(null);
                        setQuoteModalOpen(true);
                      }}
                      className={`${ui.btnOutlineBrand} w-full py-3`}
                    >
                      <ClipboardListIcon size={16} />
                      Save as Quote
                    </button>

                    <button
                      type="button"
                      disabled={!canGenerateClientQuote}
                      onClick={() => {
                        setError(null);
                        setClientQuoteModalOpen(true);
                      }}
                      className={`${ui.btnOutlineBrand} w-full py-3`}
                    >
                      <ExternalLinkIcon size={16} />
                      Generate Client Quote
                    </button>

                    <div
                      className="border-t border-slate-200/80 pt-1 dark:border-zinc-700/50"
                      aria-hidden
                    />
                  </>
                )}

                {user ? (
                  <Link
                    href={canProceedToCheckout ? "/checkout" : "#"}
                    aria-disabled={!canProceedToCheckout}
                    className={`${ui.btnPrimary} w-full py-3 ${
                      !canProceedToCheckout ? "pointer-events-none opacity-50" : ""
                    }`}
                    onClick={(event) => {
                      if (!canProceedToCheckout) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <CheckCircleIcon size={16} />
                    Proceed to Checkout
                  </Link>
                ) : (
                  <Link
                    href={`/login?redirect=${encodeURIComponent("/checkout")}`}
                    className={`${ui.btnPrimary} w-full py-3`}
                  >
                    <LogInIcon size={16} />
                    Log in to Checkout
                  </Link>
                )}

                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearCart()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/80 px-4 py-2.5 text-sm font-semibold text-red-700 transition duration-200 hover:border-red-300 hover:bg-red-50 active:scale-[0.99] dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <TrashIcon size={15} />
                    Clear cart
                  </button>
                )}
              </div>

              {!user && items.length > 0 && (
                <p className={`text-center text-xs ${ui.bodyMuted}`}>
                  Shipping and tax are calculated when you choose a delivery address at checkout.
                </p>
              )}
            </div>
          </section>

          <p className={`text-xs ${ui.bodyMuted}`}>
            Your cart stays saved for 30 days unless you change it.
          </p>
        </aside>
      </main>

      <SaveQuoteModal
        open={quoteModalOpen}
        loading={isSavingQuote}
        onConfirm={(quoteName) => void saveQuote(quoteName)}
        onCancel={() => {
          if (!isSavingQuote) {
            setQuoteModalOpen(false);
          }
        }}
      />

      <SaveRoomTemplateModal
        open={roomTemplateModalOpen}
        loading={isSavingRoomTemplate}
        onConfirm={(templateName) => void saveRoomTemplate(templateName)}
        onCancel={() => {
          if (!isSavingRoomTemplate) {
            setRoomTemplateModalOpen(false);
          }
        }}
      />

      <GenerateClientQuoteModal
        open={clientQuoteModalOpen}
        loading={isGeneratingClientQuote}
        items={items}
        companyLogoUrl={quoteBranding?.companyLogoUrl}
        onConfirm={generateClientQuote}
        onCancel={() => {
          if (!isGeneratingClientQuote) {
            setClientQuoteModalOpen(false);
          }
        }}
      />
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense
      fallback={<LoadingState fullScreen label="Loading cart..." spinnerSize="lg" />}
    >
      <CartPageContent />
    </Suspense>
  );
}
