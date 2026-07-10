"use client";

import { ui } from "@/lib/ui-classes";
import type { ShippingAddressInput } from "@/types/shipping-address";

type ShippingAddressFormFieldsProps = {
  value: ShippingAddressInput;
  onChange: (patch: Partial<ShippingAddressInput>) => void;
  idPrefix?: string;
};

export function ShippingAddressFormFields({
  value,
  onChange,
  idPrefix = "shipping-address",
}: ShippingAddressFormFieldsProps) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className={ui.fieldLabel}>Site name</span>
        <input
          id={`${idPrefix}-title`}
          className={`w-full ${ui.input}`}
          value={value.addressTitle}
          onChange={(event) => onChange({ addressTitle: event.target.value })}
          placeholder="West Campus Project"
        />
      </label>

      <label className="block space-y-1.5">
        <span className={ui.fieldLabel}>Street address</span>
        <input
          id={`${idPrefix}-street`}
          className={`w-full ${ui.input}`}
          value={value.streetAddress}
          onChange={(event) => onChange({ streetAddress: event.target.value })}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className={ui.fieldLabel}>City</span>
          <input
            id={`${idPrefix}-city`}
            className={`w-full ${ui.input}`}
            value={value.city}
            onChange={(event) => onChange({ city: event.target.value })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={ui.fieldLabel}>State</span>
          <input
            id={`${idPrefix}-state`}
            className={`w-full ${ui.input}`}
            value={value.state ?? "TX"}
            onChange={(event) => onChange({ state: event.target.value })}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={ui.fieldLabel}>ZIP code</span>
        <input
          id={`${idPrefix}-zip`}
          className={`w-full ${ui.input}`}
          inputMode="numeric"
          autoComplete="postal-code"
          value={value.zipCode}
          onChange={(event) => onChange({ zipCode: event.target.value })}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={ui.fieldLabel}>Site contact (optional)</span>
          <input
            id={`${idPrefix}-contact`}
            className={`w-full ${ui.input}`}
            value={value.contactPerson ?? ""}
            onChange={(event) => onChange({ contactPerson: event.target.value })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={ui.fieldLabel}>Contact phone (optional)</span>
          <input
            id={`${idPrefix}-phone`}
            className={`w-full ${ui.input}`}
            value={value.contactPhone ?? ""}
            onChange={(event) => onChange({ contactPhone: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

export function emptyShippingAddressInput(): ShippingAddressInput {
  return {
    addressTitle: "",
    streetAddress: "",
    city: "",
    state: "TX",
    zipCode: "",
    contactPerson: "",
    contactPhone: "",
  };
}

export function shippingAddressToInput(
  address: Pick<
    import("@/types/shipping-address").ShippingAddress,
    | "addressTitle"
    | "streetAddress"
    | "city"
    | "state"
    | "zipCode"
    | "contactPerson"
    | "contactPhone"
  >
): ShippingAddressInput {
  return {
    addressTitle: address.addressTitle,
    streetAddress: address.streetAddress,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    contactPerson: address.contactPerson ?? "",
    contactPhone: address.contactPhone ?? "",
  };
}
