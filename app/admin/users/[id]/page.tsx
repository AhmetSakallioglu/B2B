"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useState } from "react";
import { AdminAlert, AdminBadge, AdminButton } from "@/components/admin/admin-ui";
import { AdminShell } from "@/components/admin/AdminShell";
import { ImpersonateCustomerButton } from "@/components/admin/ImpersonateCustomerButton";
import { refreshAdminNotifications } from "@/components/admin/AdminNotificationsProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ACCOUNT_STATUS_LABELS, getApprovalConfirmDialog, getApprovalSuccessMessage } from "@/lib/user-approval";
import { formatDate } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import { createEmptyAdminPermissions, type AdminPermissions } from "@/types/admin-permissions";
import { TAX_EXEMPTION_STATUS_LABELS } from "@/types/tax-exemption";
import type { AdminUserDetail, CustomerTier } from "@/types/customer-tier";
import { USER_GROUP_TAGS } from "@/types/user-segmentation";

export default function AdminUserEditPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { confirm } = useConfirm();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [tiers, setTiers] = useState<CustomerTier[]>([]);
  const [form, setForm] = useState({
    role: "customer" as "customer" | "admin",
    tierId: "",
    companyName: "",
    contactName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    groupTag: "New",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPermissions, setCurrentPermissions] = useState<AdminPermissions>(
    createEmptyAdminPermissions()
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [userResponse, tiersResponse] = await Promise.all([
        fetch(`/api/admin/users/${userId}`),
        fetch("/api/admin/tiers"),
      ]);

      if (!userResponse.ok) {
        throw new Error("User not found");
      }

      if (!tiersResponse.ok) {
        throw new Error("Failed to load tiers");
      }

      const userData = (await userResponse.json()) as { user: AdminUserDetail };
      const tiersData = (await tiersResponse.json()) as { tiers: CustomerTier[] };

      setUser(userData.user);
      setTiers(tiersData.tiers);
      setForm({
        role: userData.user.role,
        tierId: userData.user.tier ? String(userData.user.tier.id) : "",
        companyName: userData.user.companyName,
        contactName: userData.user.contactName,
        phone: userData.user.phone,
        addressLine1: userData.user.addressLine1,
        addressLine2: userData.user.addressLine2,
        city: userData.user.city,
        state: userData.user.state,
        postalCode: userData.user.postalCode,
        country: userData.user.country,
        groupTag: userData.user.groupTag,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load user");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useDeferredEffect(() => {
    const loadCurrentAdmin = async () => {
      const response = await fetch("/api/auth/me");

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { permissions?: AdminPermissions };
      setCurrentPermissions(data.permissions ?? createEmptyAdminPermissions());
    };

    void loadCurrentAdmin();
  }, []);

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "role" && value === "admin") {
        next.tierId = "";
      }

      return next;
    });
  };

  const handleApproval = async (action: "approve" | "reject") => {
    if (!user) {
      return;
    }

    const confirmed = await confirm(getApprovalConfirmDialog(user.accountStatus, action));

    if (!confirmed) {
      return;
    }

    setIsReviewing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as { error?: string; user?: AdminUserDetail };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update account access");
      }

      if (data.user) {
        setUser(data.user);
      }

      if (user.accountStatus === "pending") {
        refreshAdminNotifications();
      }

      setMessage(getApprovalSuccessMessage(user.accountStatus, action));
      router.refresh();
    } catch (approvalError) {
      setError(
        approvalError instanceof Error ? approvalError.message : "Failed to update account access"
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: form.role,
          tierId: form.role === "customer" ? (form.tierId ? Number(form.tierId) : null) : null,
          companyName: form.companyName,
          contactName: form.contactName,
          phone: form.phone,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: form.country,
          groupTag: form.role === "customer" ? form.groupTag : undefined,
        }),
      });

      const data = (await response.json()) as { error?: string; user?: AdminUserDetail };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update user");
      }

      if (data.user) {
        setUser(data.user);
      }

      setMessage("User updated successfully.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update user");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminShell title="Edit User">
        <p className="text-muted dark:text-cream/70">Loading user...</p>
      </AdminShell>
    );
  }

  if (error && !user) {
    return (
      <AdminShell title="Edit User">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <Link
            href="/admin/users"
            className="mt-4 inline-flex rounded-full bg-brand px-4 py-2 text-sm text-white"
          >
            Back to users
          </Link>
        </div>
      </AdminShell>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AdminShell
      title={user.email}
      subtitle="Manage role, tier discount, and company profile"
    >
      <div className="mb-6">
        <Link
          href="/admin/users"
          className="text-sm font-medium text-muted transition hover:text-navy dark:text-cream/75 dark:hover:text-cream"
        >
          ← Back to users
        </Link>
      </div>

      {message && <AdminAlert tone="success">{message}</AdminAlert>}
      {error && user && <AdminAlert tone="error">{error}</AdminAlert>}

      {user.role === "customer" && (
        <>
        <section className={`mb-6 p-6 ${ui.adminCard}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-navy dark:text-cream">Account access</h2>
              <p className="mt-2 text-sm text-muted dark:text-cream/70">
                Approved members can sign in and order. Ban a member to revoke access immediately.
                Banned or pending members cannot use the site.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <AdminBadge
                  tone={
                    user.accountStatus === "approved"
                      ? "success"
                      : user.accountStatus === "pending"
                        ? "brand"
                        : "danger"
                  }
                >
                  {ACCOUNT_STATUS_LABELS[user.accountStatus]}
                </AdminBadge>
                {user.reviewedAt && (
                  <span className="text-xs text-muted dark:text-cream/60">
                    Last reviewed {formatDate(user.reviewedAt)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.accountStatus !== "approved" && (
                <AdminButton
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={isReviewing}
                  onClick={() => handleApproval("approve")}
                >
                  {user.accountStatus === "rejected" ? "Reinstate member" : "Approve account"}
                </AdminButton>
              )}
              {user.accountStatus !== "rejected" && (
                <AdminButton
                  type="button"
                  variant="danger"
                  size="md"
                  disabled={isReviewing}
                  onClick={() => handleApproval("reject")}
                >
                  {user.accountStatus === "approved" ? "Ban member" : "Reject registration"}
                </AdminButton>
              )}
              {user.role === "customer" &&
                user.accountStatus === "approved" &&
                (currentPermissions.isSuperAdmin || currentPermissions.can_impersonate_users) && (
                  <ImpersonateCustomerButton userId={user.id} disabled={isReviewing} />
                )}
            </div>
          </div>
        </section>

        {(user.federalTaxId ||
          user.taxExemptionStatus !== "NONE" ||
          user.taxStatus === "exempt" ||
          user.billingFirstName ||
          user.shippingFirstName ||
          user.applicationNotes ||
          user.alternatePhone) && (
          <section className={`mb-6 p-6 lg:col-span-2 ${ui.adminCard}`}>
            <h2 className="text-lg font-semibold text-navy dark:text-cream">
              Dealer application details
            </h2>
            <p className="mt-2 text-sm text-muted dark:text-cream/70">
              Read-only data submitted with the dealer registration form.
            </p>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                Tax exemption status
              </dt>
              <dd className="text-sm text-navy dark:text-cream sm:col-span-2 lg:col-span-1">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    user.isTaxExempt
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : user.taxExemptionStatus === "PENDING"
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                        : user.taxExemptionStatus === "REJECTED"
                          ? "bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-100"
                          : "bg-slate-100 text-slate-800 dark:bg-navy-hover dark:text-cream"
                  }`}
                >
                  {TAX_EXEMPTION_STATUS_LABELS[user.taxExemptionStatus]}
                  {user.isTaxExempt ? " · Active" : ""}
                </span>
              </dd>

              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                Checkout tax status
              </dt>
              <dd className="text-sm text-navy dark:text-cream sm:col-span-2 lg:col-span-1">
                {user.isTaxExempt ? "Tax exempt" : "Taxable"}
              </dd>

              {user.federalTaxId && (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Federal Tax ID (EIN)
                  </dt>
                  <dd className="text-sm text-navy dark:text-cream sm:col-span-2 lg:col-span-1">
                    {user.federalTaxId}
                  </dd>
                </>
              )}

              {(user.taxExemptionStatus !== "NONE" || user.taxStatus === "exempt") &&
                user.businessType && (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Business type
                  </dt>
                  <dd className="text-sm text-navy dark:text-cream">{user.businessType}</dd>
                </>
              )}

              {(user.taxExemptionStatus !== "NONE" || user.taxStatus === "exempt") &&
                user.expectedMonthlySales && (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Expected monthly sales
                  </dt>
                  <dd className="text-sm text-navy dark:text-cream">
                    {user.expectedMonthlySales}
                  </dd>
                </>
              )}

              {(user.taxExemptionStatus !== "NONE" || user.taxStatus === "exempt") &&
                user.salesTaxAccount && (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Sales tax account
                  </dt>
                  <dd className="text-sm text-navy dark:text-cream">{user.salesTaxAccount}</dd>
                </>
              )}

              {(user.taxExemptionStatus !== "NONE" || user.taxStatus === "exempt") &&
                user.hasResaleLicense !== null && (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Resale license
                  </dt>
                  <dd className="text-sm text-navy dark:text-cream">
                    {user.hasResaleLicense ? "Yes" : "No"}
                  </dd>
                </>
              )}

              {(user.taxExemptionStatus !== "NONE" || user.taxStatus === "exempt") &&
                user.resaleLicenseNumber && (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Resale license number
                  </dt>
                  <dd className="text-sm text-navy dark:text-cream">{user.resaleLicenseNumber}</dd>
                </>
              )}

              {user.alternatePhone && (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Alternate phone
                  </dt>
                  <dd className="text-sm text-navy dark:text-cream">{user.alternatePhone}</dd>
                </>
              )}
              {user.fax && (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Fax</dt>
                  <dd className="text-sm text-navy dark:text-cream">{user.fax}</dd>
                </>
              )}
            </dl>

            {(user.billingFirstName || user.billingPhone) && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-navy dark:text-cream">Billing contact</h3>
                <p className="mt-2 text-sm text-muted dark:text-cream/75">
                  {[user.billingFirstName, user.billingLastName].filter(Boolean).join(" ")}
                  {user.billingPhone ? ` · ${user.billingPhone}` : ""}
                </p>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-navy dark:text-cream">Shipping address</h3>
              {user.shippingSameAsBilling ? (
                <p className="mt-2 text-sm text-muted dark:text-cream/75">
                  Same as billing address
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted dark:text-cream/75">
                  {[user.shippingFirstName, user.shippingLastName].filter(Boolean).join(" ")}
                  <br />
                  {user.shippingAddressLine1}
                  {user.shippingAddressLine2 ? `, ${user.shippingAddressLine2}` : ""}
                  <br />
                  {[user.shippingCity, user.shippingState, user.shippingPostalCode]
                    .filter(Boolean)
                    .join(", ")}
                  {user.shippingCountry ? ` · ${user.shippingCountry}` : ""}
                  {user.shippingPhone ? (
                    <>
                      <br />
                      {user.shippingPhone}
                    </>
                  ) : null}
                </p>
              )}
            </div>

            {user.applicationNotes && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-navy dark:text-cream">
                  Application notes
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted dark:text-cream/75">
                  {user.applicationNotes}
                </p>
              </div>
            )}

            {(user.resaleCertificateUrl || user.taxDocumentUrl) && (
              <div className="mt-6 rounded-2xl border border-amber-300/50 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
                <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                  Resale certificate
                </h3>
                <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/80">
                  {user.taxExemptionStatus === "PENDING"
                    ? "This certificate is awaiting tax exemption review."
                    : user.isTaxExempt
                      ? "Approved certificate on file."
                      : "Certificate uploaded during registration or account settings."}
                </p>
                {user.taxExemptionRejectionReason && (
                  <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                    Rejection reason: {user.taxExemptionRejectionReason}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={`/api/admin/users/${user.id}/tax-document`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-full border border-brand/30 bg-white px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand-light dark:bg-navy"
                  >
                    View certificate
                  </a>
                  {user.taxExemptionStatus === "PENDING" &&
                    (currentPermissions.isSuperAdmin ||
                      currentPermissions.can_approve_tax_exemption) && (
                      <Link
                        href="/admin/users/tax-exemptions"
                        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-navy dark:text-cream"
                      >
                        Open tax exemption queue
                      </Link>
                    )}
                </div>
              </div>
            )}
          </section>
        )}
        </>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        <section className={`p-6 ${ui.adminCard}`}>
          <h2 className="text-lg font-semibold text-navy dark:text-cream">
            Authorization
          </h2>
          <p className="mt-2 text-sm text-muted dark:text-cream/70">
            Assign admin access or customer tier discounts.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Role
              </span>
              <select
                value={form.role}
                onChange={(event) =>
                  updateField("role", event.target.value as "customer" | "admin")
                }
                className={`w-full ${ui.select}`}
              >
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            {form.role === "customer" && (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Dealer group
                </span>
                <select
                  value={form.groupTag}
                  onChange={(event) => updateField("groupTag", event.target.value)}
                  className={`w-full ${ui.select}`}
                >
                  {USER_GROUP_TAGS.map((groupTag) => (
                    <option key={groupTag} value={groupTag}>
                      {groupTag}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {form.role === "customer" && (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Customer tier
                </span>
                <select
                  value={form.tierId}
                  onChange={(event) => updateField("tierId", event.target.value)}
                  className={`w-full ${ui.select}`}
                >
                  <option value="">No tier / standard pricing</option>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} — {tier.discountPercent}% discount
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        <section className={`p-6 ${ui.adminCard}`}>
          <h2 className="text-lg font-semibold text-navy dark:text-cream">
            Company profile
          </h2>
          <p className="mt-2 text-sm text-muted dark:text-cream/70">
            Edit the member&apos;s business and delivery details.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["companyName", "Company name"],
                ["contactName", "Contact name"],
                ["phone", "Phone"],
                ["addressLine1", "Address line 1"],
                ["addressLine2", "Address line 2"],
                ["city", "City"],
                ["state", "State"],
                ["postalCode", "Postal code"],
                ["country", "Country"],
              ] as const
            ).map(([field, label]) => (
              <label
                key={field}
                className={`block space-y-1.5 ${field === "addressLine1" || field === "addressLine2" ? "sm:col-span-2" : ""}`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {label}
                </span>
                <input
                  value={form[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                  className={`w-full ${ui.select}`}
                />
              </label>
            ))}
          </div>
        </section>

        <div className="lg:col-span-2">
          {message && (
            <p className={`mb-4 px-4 py-3 text-sm ${ui.cardMuted}`}>
              {message}
            </p>
          )}
          {error && (
            <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className={ui.btnPrimary}
          >
            {isSaving ? "Saving..." : "Save user changes"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
