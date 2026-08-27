"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { AdminButton, AdminFieldLabel, AdminInput } from "@/components/admin/admin-ui";
import { UserPlusIcon } from "@/components/ui/Icon";
import { ui } from "@/lib/ui-classes";
import type { AdminUserSummary } from "@/types/customer-tier";

type AdminCreateUserModalProps = {
  open: boolean;
  canApprove: boolean;
  onClose: () => void;
  onCreated: (user: AdminUserSummary) => void;
};

const EMPTY_FORM = {
  email: "",
  password: "",
  companyName: "",
  contactName: "",
  phone: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  approveImmediately: false,
};

export function AdminCreateUserModal({
  open,
  canApprove,
  onClose,
  onCreated,
}: AdminCreateUserModalProps) {
  const titleId = useId();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(EMPTY_FORM);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSaving, onClose, open]);

  const updateField = (field: keyof typeof EMPTY_FORM, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password || undefined,
          companyName: form.companyName,
          contactName: form.contactName,
          phone: form.phone,
          addressLine1: form.addressLine1,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          accountStatus: canApprove && form.approveImmediately ? "approved" : "pending",
        }),
      });

      const data = (await response.json()) as { error?: string; user?: AdminUserSummary };

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? "Failed to create member");
      }

      onCreated(data.user);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to create member");
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl ${ui.adminCard}`}
      >
        <header className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand-light/40 text-brand">
                <UserPlusIcon size={18} />
              </span>
              <div>
                <h2 id={titleId} className={ui.heading3}>
                  Add member
                </h2>
                <p className={`mt-0.5 ${ui.bodyMuted}`}>
                  Only email is required. Other fields can be filled in later.
                </p>
              </div>
            </div>
            <AdminButton type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
              Close
            </AdminButton>
          </div>
        </header>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            <label className="block space-y-1.5">
              <AdminFieldLabel>Email</AdminFieldLabel>
              <AdminInput
                type="email"
                required
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="dealer@example.com"
              />
            </label>

            <label className="block space-y-1.5">
              <AdminFieldLabel>Password (optional)</AdminFieldLabel>
              <AdminInput
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Leave blank if they should not sign in yet"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <AdminFieldLabel>Company</AdminFieldLabel>
                <AdminInput
                  value={form.companyName}
                  onChange={(event) => updateField("companyName", event.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>Contact name</AdminFieldLabel>
                <AdminInput
                  value={form.contactName}
                  onChange={(event) => updateField("contactName", event.target.value)}
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <AdminFieldLabel>Phone</AdminFieldLabel>
              <AdminInput
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </label>

            <label className="block space-y-1.5">
              <AdminFieldLabel>Street address</AdminFieldLabel>
              <AdminInput
                value={form.addressLine1}
                onChange={(event) => updateField("addressLine1", event.target.value)}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-1.5">
                <AdminFieldLabel>City</AdminFieldLabel>
                <AdminInput
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>State</AdminFieldLabel>
                <AdminInput
                  value={form.state}
                  onChange={(event) => updateField("state", event.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>ZIP</AdminFieldLabel>
                <AdminInput
                  value={form.postalCode}
                  onChange={(event) => updateField("postalCode", event.target.value)}
                />
              </label>
            </div>

            {canApprove && (
              <label className="flex items-start gap-3 rounded-xl border border-slate-200/80 px-4 py-3 dark:border-zinc-700/50">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.approveImmediately}
                  onChange={(event) => updateField("approveImmediately", event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-cream">
                    Approve immediately
                  </span>
                  <span className={`mt-0.5 block text-xs ${ui.bodyMuted}`}>
                    They will be able to sign in if a password is set.
                  </span>
                </span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
            <AdminButton type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create member"}
            </AdminButton>
          </div>
        </form>
      </div>
    </div>
  );
}
