"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CustomerAccountNav } from "@/components/account/CustomerAccountNav";
import {
  emptyShippingAddressInput,
  ShippingAddressFormFields,
  shippingAddressToInput,
} from "@/components/shipping/ShippingAddressFormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { LayersIcon, PlusIcon, StoreIcon, TrashIcon } from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";
import type { ShippingAddress, ShippingAddressInput } from "@/types/shipping-address";

type EditorMode = { kind: "create" } | { kind: "edit"; addressId: string };

export function ShippingAddressBookPanel() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [form, setForm] = useState<ShippingAddressInput>(emptyShippingAddressInput());
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ShippingAddress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAddresses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account/shipping-addresses");

      if (response.status === 401) {
        router.replace("/login?redirect=/account/shipping-addresses");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load shipping addresses");
      }

      const data = (await response.json()) as { addresses: ShippingAddress[] };
      setAddresses(data.addresses);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load addresses");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useDeferredEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  const openCreateForm = () => {
    setMessage(null);
    setError(null);
    setEditorMode({ kind: "create" });
    setForm(emptyShippingAddressInput());
  };

  const openEditForm = (address: ShippingAddress) => {
    setMessage(null);
    setError(null);
    setEditorMode({ kind: "edit", addressId: address.id });
    setForm(shippingAddressToInput(address));
  };

  const closeEditor = () => {
    setEditorMode(null);
    setForm(emptyShippingAddressInput());
  };

  const updateForm = (patch: Partial<ShippingAddressInput>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const saveAddress = async () => {
    if (!editorMode || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const isEdit = editorMode.kind === "edit";
      const response = await fetch(
        isEdit
          ? `/api/account/shipping-addresses/${editorMode.addressId}`
          : "/api/account/shipping-addresses",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save address");
      }

      closeEditor();
      setMessage(isEdit ? "Shipping address updated." : "Shipping address saved.");
      await loadAddresses();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save address");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/account/shipping-addresses/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete address");
      }

      if (editorMode?.kind === "edit" && editorMode.addressId === deleteTarget.id) {
        closeEditor();
      }

      setDeleteTarget(null);
      setMessage(`"${deleteTarget.addressTitle}" removed from your address book.`);
      await loadAddresses();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete address");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <LoadingState fullScreen label="Loading shipping addresses..." spinnerSize="lg" />;
  }

  return (
    <div className={ui.catalogPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainerNarrow} py-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={ui.eyebrow}>My Account</p>
              <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
                <LayersIcon size={26} className="text-brand" />
                Shipping addresses
              </h1>
              <p className={`mt-1.5 ${ui.bodyMuted}`}>
                Manage job site delivery addresses for faster checkout.
              </p>
            </div>
            <Link href="/" className={ui.btnSecondary}>
              <IconLabel icon={<StoreIcon size={15} />}>Back to catalog</IconLabel>
            </Link>
          </div>

          <div className="mt-5">
            <CustomerAccountNav active="addresses" />
          </div>
        </div>
      </header>

      <main className={`${ui.pageContainerNarrow} space-y-6 py-8`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm ${ui.bodyMuted}`}>
            {addresses.length === 0
              ? "No saved job sites yet. Add your first delivery address below."
              : `${addresses.length} saved job site${addresses.length === 1 ? "" : "s"}.`}
          </p>
          {!editorMode && (
            <button type="button" onClick={openCreateForm} className={ui.btnPrimary}>
              <PlusIcon size={16} />
              Add address
            </button>
          )}
        </div>

        {message && (
          <p className="rounded-xl bg-navy/5 px-4 py-3 text-sm text-navy dark:bg-cream/10 dark:text-cream">
            {message}
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {editorMode && (
          <section className={`p-6 ${ui.catalogCard}`}>
            <h2 className={ui.heading3}>
              {editorMode.kind === "create" ? "Add shipping address" : "Edit shipping address"}
            </h2>
            <p className={`mt-1 ${ui.bodyMuted}`}>
              These addresses appear at checkout when you choose a delivery site.
            </p>

            <div className="mt-6">
              <ShippingAddressFormFields
                value={form}
                onChange={updateForm}
                idPrefix={editorMode.kind === "edit" ? `edit-${editorMode.addressId}` : "create"}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveAddress()}
                className={ui.btnPrimary}
              >
                {isSaving ? "Saving..." : editorMode.kind === "create" ? "Save address" : "Update address"}
              </button>
              <button type="button" disabled={isSaving} onClick={closeEditor} className={ui.btnSecondary}>
                Cancel
              </button>
            </div>
          </section>
        )}

        {addresses.length === 0 && !editorMode ? (
          <section className={`px-6 py-12 text-center ${ui.emptyState}`}>
            <LayersIcon size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-base font-semibold text-slate-900 dark:text-cream">
              No shipping addresses saved
            </p>
            <p className={`mt-2 ${ui.bodyMuted}`}>
              Add job site addresses here, or save them during checkout for future orders.
            </p>
            <button type="button" onClick={openCreateForm} className={`mt-4 inline-flex ${ui.btnPrimary}`}>
              <PlusIcon size={15} />
              Add your first address
            </button>
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {addresses.map((address) => (
              <article key={address.id} className={`p-5 ${ui.catalogCard}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-cream">
                      {address.addressTitle}
                    </h3>
                    <p className={`mt-2 text-sm ${ui.bodyMuted}`}>
                      {address.streetAddress}
                      <br />
                      {address.city}, {address.state} {address.zipCode}
                    </p>
                    {(address.contactPerson || address.contactPhone) && (
                      <p className={`mt-2 text-xs ${ui.bodyMuted}`}>
                        {[address.contactPerson, address.contactPhone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(address)}
                    className={ui.btnSecondary}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(address)}
                    className={`${ui.btnGhost} text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300`}
                  >
                    <TrashIcon size={14} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className={`text-sm ${ui.bodyMuted}`}>
          Your company billing address is managed under{" "}
          <Link href="/account" className="font-semibold text-brand underline underline-offset-2">
            My Account
          </Link>
          . At checkout you can also choose &quot;Same as billing / company address&quot;.
        </p>
      </main>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete shipping address?"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.addressTitle}" from your address book? Past orders that used this address will keep their delivery snapshot.`
            : ""
        }
        confirmLabel="Delete address"
        variant="danger"
        tone="danger"
        loading={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
