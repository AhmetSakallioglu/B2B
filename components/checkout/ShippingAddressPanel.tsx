"use client";

import Link from "next/link";
import { useState } from "react";
import {
  emptyShippingAddressInput,
  ShippingAddressFormFields,
} from "@/components/shipping/ShippingAddressFormFields";
import { ui } from "@/lib/ui-classes";
import { billingAddressFromProfile } from "@/lib/shipping-address-display";
import type { UserProfile } from "@/types/account";
import type { ShippingAddress, ShippingAddressInput } from "@/types/shipping-address";

export type ShippingSelectionState =
  | { kind: "billing" }
  | { kind: "saved"; addressId: string }
  | { kind: "new"; draft: ShippingAddressInput; saveForFuture: boolean };

type ShippingAddressPanelProps = {
  profile: UserProfile;
  savedAddresses: ShippingAddress[];
  selection: ShippingSelectionState | null;
  onSelectionChange: (selection: ShippingSelectionState) => void;
};

const emptyDraft = emptyShippingAddressInput;

export function ShippingAddressPanel({
  profile,
  savedAddresses,
  selection,
  onSelectionChange,
}: ShippingAddressPanelProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const billing = billingAddressFromProfile(profile);

  const newDraft =
    selection?.kind === "new" ? selection.draft : emptyDraft();
  const saveForFuture = selection?.kind === "new" ? selection.saveForFuture : true;

  const selectBilling = () => {
    setShowNewForm(false);
    onSelectionChange({ kind: "billing" });
  };

  const selectSaved = (addressId: string) => {
    setShowNewForm(false);
    onSelectionChange({ kind: "saved", addressId });
  };

  const openNewForm = () => {
    setShowNewForm(true);
    onSelectionChange({
      kind: "new",
      draft: emptyDraft(),
      saveForFuture: true,
    });
  };

  const updateDraft = (patch: Partial<ShippingAddressInput>) => {
    onSelectionChange({
      kind: "new",
      draft: { ...newDraft, ...patch },
      saveForFuture,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className={ui.heading3}>Shipping information</h2>
        <p className={`mt-1 ${ui.bodyMuted}`}>
          Choose where this order should be delivered. Rates are based on the site ZIP code.
        </p>
      </div>

      <label
        className={`block cursor-pointer rounded-2xl border p-4 transition ${
          selection?.kind === "billing"
            ? "border-brand bg-brand-light/20 dark:border-brand/40 dark:bg-brand-light/10"
            : "border-slate-200/80 bg-white dark:border-zinc-700/50 dark:bg-navy"
        }`}
      >
        <div className="flex items-start gap-3">
          <input
            type="radio"
            name="shippingSelection"
            checked={selection?.kind === "billing"}
            onChange={selectBilling}
            className="mt-1 accent-brand"
          />
          <div>
            <p className="font-semibold text-slate-900 dark:text-cream">
              Same as billing / company address
            </p>
            <p className={`mt-1 text-sm ${ui.bodyMuted}`}>
              {billing.streetAddress}
              {billing.city ? `, ${billing.city}` : ""}
              {billing.state ? `, ${billing.state}` : ""} {billing.zipCode}
            </p>
          </div>
        </div>
      </label>

      {savedAddresses.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-cream">Saved job sites</p>
            <Link
              href="/account/shipping-addresses"
              className="text-xs font-semibold text-brand underline underline-offset-2"
            >
              Manage addresses
            </Link>
          </div>
          {savedAddresses.map((address) => (
            <label
              key={address.id}
              className={`block cursor-pointer rounded-2xl border p-4 transition ${
                selection?.kind === "saved" && selection.addressId === address.id
                  ? "border-brand bg-brand-light/20 dark:border-brand/40 dark:bg-brand-light/10"
                  : "border-slate-200/80 bg-white dark:border-zinc-700/50 dark:bg-navy"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="shippingSelection"
                  checked={selection?.kind === "saved" && selection.addressId === address.id}
                  onChange={() => selectSaved(address.id)}
                  className="mt-1 accent-brand"
                />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-cream">
                    {address.addressTitle}
                  </p>
                  <p className={`mt-1 text-sm ${ui.bodyMuted}`}>
                    {address.streetAddress}, {address.city}, {address.state} {address.zipCode}
                  </p>
                  {(address.contactPerson || address.contactPhone) && (
                    <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
                      {[address.contactPerson, address.contactPhone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      {!showNewForm ? (
        <button type="button" onClick={openNewForm} className={`${ui.btnSecondary} w-full`}>
          Add new shipping address
        </button>
      ) : (
        <div className={`space-y-4 rounded-2xl border border-slate-200/80 p-4 dark:border-zinc-700/50 ${ui.adminCard}`}>
          <p className="font-semibold text-slate-900 dark:text-cream">New shipping address</p>

          <ShippingAddressFormFields value={newDraft} onChange={updateDraft} idPrefix="checkout-new" />

          <label className={`flex items-start gap-3 text-sm ${ui.cardMuted}`}>
            <input
              type="checkbox"
              checked={saveForFuture}
              onChange={(event) =>
                onSelectionChange({
                  kind: "new",
                  draft: newDraft,
                  saveForFuture: event.target.checked,
                })
              }
              className="mt-0.5 accent-brand"
            />
            <span>Save this address for future projects</span>
          </label>
        </div>
      )}
    </div>
  );
}

export function shippingSelectionToCheckoutPayload(
  selection: ShippingSelectionState
): import("@/types/shipping-address").CheckoutShippingSelection {
  if (selection.kind === "billing") {
    return { type: "billing" };
  }

  if (selection.kind === "saved") {
    return { type: "saved", addressId: selection.addressId };
  }

  return {
    type: "new",
    address: selection.draft,
    saveForFuture: selection.saveForFuture,
  };
}

export async function resolveZipFromSelection(
  profile: UserProfile,
  savedAddresses: ShippingAddress[],
  selection: ShippingSelectionState | null
): Promise<string | null> {
  if (!selection) {
    return null;
  }

  if (selection.kind === "billing") {
    const billing = billingAddressFromProfile(profile);
    return billing.zipCode.trim() || null;
  }

  if (selection.kind === "saved") {
    const address = savedAddresses.find((entry) => entry.id === selection.addressId);
    return address?.zipCode ?? null;
  }

  return selection.draft.zipCode.trim() || null;
}
