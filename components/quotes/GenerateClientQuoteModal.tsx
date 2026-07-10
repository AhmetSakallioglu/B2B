"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { toCheckoutLineItems } from "@/lib/cart-checkout";
import {
  CLIENT_EMAIL_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  MARKUP_PRESETS,
} from "@/lib/client-quote-validation";
import { ui } from "@/lib/ui-classes";
import type { OrderCartItem } from "@/types/catalog";
import type { ShippingAddress } from "@/types/shipping-address";

type MarkupMode = "preset" | "custom";

type GenerateClientQuoteModalProps = {
  open: boolean;
  loading?: boolean;
  items: OrderCartItem[];
  companyLogoUrl?: string | null;
  onConfirm: (formData: FormData) => Promise<void>;
  onCancel: () => void;
};

export function GenerateClientQuoteModal({
  open,
  loading = false,
  items,
  companyLogoUrl,
  onConfirm,
  onCancel,
}: GenerateClientQuoteModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [markupMode, setMarkupMode] = useState<MarkupMode>("preset");
  const [markupPreset, setMarkupPreset] = useState<number>(0);
  const [customMarkup, setCustomMarkup] = useState("15");
  const [includeTax, setIncludeTax] = useState(false);
  const [includeShipping, setIncludeShipping] = useState(false);
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);

  useDeferredEffect(() => {
    if (!open) {
      setClientName("");
      setClientEmail("");
      setMarkupMode("preset");
      setMarkupPreset(0);
      setCustomMarkup("15");
      setIncludeTax(false);
      setIncludeShipping(false);
      setShippingAddressId("");
      return;
    }

    let cancelled = false;
    setAddressesLoading(true);

    void fetch("/api/account/shipping-addresses")
      .then(async (response) => {
        if (!response.ok) {
          return { addresses: [] as ShippingAddress[] };
        }

        return (await response.json()) as { addresses: ShippingAddress[] };
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        setShippingAddresses(data.addresses);

        if (data.addresses.length > 0) {
          setShippingAddressId(data.addresses[0]!.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShippingAddresses([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAddressesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [loading, onCancel, open]);

  if (!open) {
    return null;
  }

  const resolvedMarkup =
    markupMode === "preset" ? markupPreset : Number.parseFloat(customMarkup);

  const markupIsValid =
    Number.isFinite(resolvedMarkup) && resolvedMarkup >= 0 && resolvedMarkup <= 100;

  const shippingSelectionValid = !includeShipping || Boolean(shippingAddressId);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (
      !markupIsValid ||
      !shippingSelectionValid ||
      clientName.trim().length < 2 ||
      items.length === 0
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("clientName", clientName.trim());
    formData.set("markupPercentage", String(resolvedMarkup));
    formData.set("includeTax", String(includeTax));
    formData.set("includeShipping", String(includeShipping));
    formData.set("items", JSON.stringify(toCheckoutLineItems(items)));

    if (clientEmail.trim()) {
      formData.set("clientEmail", clientEmail.trim());
    }

    if (includeShipping && shippingAddressId) {
      formData.set("shippingAddressId", shippingAddressId);
    }

    await onConfirm(formData);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl dark:bg-slate-900 ${ui.adminCard}`}
      >
        <h2 id={titleId} className={ui.heading2}>
          Generate Client Quote
        </h2>
        <p id={descriptionId} className={`mt-2 ${ui.bodyMuted}`}>
          Create a white-label PDF for your client. Pricing starts from your net dealer cost.
          Cabinetto branding and your margin are never shown to the client.
        </p>

        {!companyLogoUrl && (
          <p className="mt-3 rounded-xl border border-brand/20 bg-brand-light/30 px-4 py-3 text-sm text-slate-800 dark:text-cream">
            Add your company logo under{" "}
            <Link href="/account" className="font-semibold text-brand underline underline-offset-2">
              My Account → Client quote branding
            </Link>{" "}
            so it appears on the PDF header.
          </p>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-5">
          <div>
            <label htmlFor={`${titleId}-client-name`} className={ui.fieldLabel}>
              Client / project name
            </label>
            <input
              id={`${titleId}-client-name`}
              type="text"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              maxLength={CLIENT_NAME_MAX_LENGTH}
              placeholder='e.g. "Smith Residence Kitchen"'
              autoFocus
              disabled={loading}
              className={ui.input}
            />
          </div>

          <div>
            <label htmlFor={`${titleId}-client-email`} className={ui.fieldLabel}>
              Client email <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id={`${titleId}-client-email`}
              type="email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              maxLength={CLIENT_EMAIL_MAX_LENGTH}
              placeholder="client@example.com"
              disabled={loading}
              className={ui.input}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className={ui.fieldLabel}>Client pricing adjustment</legend>

            <div className="space-y-2">
              {MARKUP_PRESETS.map((preset) => (
                <label
                  key={preset}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700"
                >
                  <input
                    type="radio"
                    name="markup"
                    checked={markupMode === "preset" && markupPreset === preset}
                    onChange={() => {
                      setMarkupMode("preset");
                      setMarkupPreset(preset);
                    }}
                    disabled={loading}
                  />
                  <span>
                    {preset === 0
                      ? "Pass through your dealer cost (no adjustment)"
                      : `Add ${preset}% to your dealer cost`}
                  </span>
                </label>
              ))}

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
                <input
                  type="radio"
                  name="markup"
                  checked={markupMode === "custom"}
                  onChange={() => setMarkupMode("custom")}
                  disabled={loading}
                  className="mt-1"
                />
                <span className="flex-1">
                  <span className="block font-medium">Custom adjustment</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={customMarkup}
                    onChange={(event) => {
                      setMarkupMode("custom");
                      setCustomMarkup(event.target.value);
                    }}
                    disabled={loading || markupMode !== "custom"}
                    className={`${ui.input} mt-2`}
                    placeholder="e.g. 15"
                  />
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className={ui.fieldLabel}>Include on quote</legend>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={includeTax}
                onChange={(event) => setIncludeTax(event.target.checked)}
                disabled={loading}
              />
              Texas sales tax (8.25%)
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={includeShipping}
                onChange={(event) => setIncludeShipping(event.target.checked)}
                disabled={loading}
              />
              Shipping &amp; delivery
            </label>
            {includeShipping && (
              <div className="space-y-2">
                {addressesLoading ? (
                  <p className={`text-sm ${ui.bodyMuted}`}>Loading shipping addresses...</p>
                ) : shippingAddresses.length > 0 ? (
                  <>
                    <label htmlFor={`${titleId}-shipping-address`} className={ui.fieldLabel}>
                      Delivery address
                    </label>
                    <select
                      id={`${titleId}-shipping-address`}
                      value={shippingAddressId}
                      onChange={(event) => setShippingAddressId(event.target.value)}
                      disabled={loading}
                      className={ui.input}
                    >
                      {shippingAddresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.addressTitle} · {address.streetAddress}, {address.city}{" "}
                          {address.zipCode}
                        </option>
                      ))}
                    </select>
                    <p className={`text-xs ${ui.bodyMuted}`}>
                      Delivery fee is calculated automatically from the selected address ZIP using
                      official shipping zones.
                    </p>
                  </>
                ) : (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                    Add a shipping address under{" "}
                    <Link
                      href="/account/shipping-addresses"
                      className="font-semibold underline underline-offset-2"
                    >
                      Shipping Addresses
                    </Link>{" "}
                    before including delivery on a client quote.
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} disabled={loading} className={ui.btnSecondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !markupIsValid ||
                !shippingSelectionValid ||
                clientName.trim().length < 2
              }
              className={`${ui.btnOutlineBrand} w-full sm:w-auto sm:min-w-[12rem]`}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" variant="brand" />
                  Generating PDF...
                </>
              ) : (
                "Download client quote PDF"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
