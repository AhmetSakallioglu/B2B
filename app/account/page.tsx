"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import {
  AccountAlert,
  AccountOverviewCard,
  AccountSectionHeader,
} from "@/components/account/AccountOverviewCard";
import { CustomerAccountNav } from "@/components/account/CustomerAccountNav";
import { TaxExemptionPanel } from "@/components/account/TaxExemptionPanel";
import { QuoteBrandingPanel } from "@/components/account/QuoteBrandingPanel";
import { LoadingState } from "@/components/ui/LoadingState";
import { KeyIcon, StoreIcon, UserIcon } from "@/components/ui/Icon";
import {
  getMissingProfileFieldsForOrdering,
  isProfileCompleteForOrdering,
  ORDER_PROFILE_INCOMPLETE_MESSAGE,
} from "@/lib/user-profile";
import { ui } from "@/lib/ui-classes";
import type { UserProfile } from "@/types/account";

const EMPTY_PROFILE: UserProfile = {
  id: 0,
  email: "",
  role: "customer",
  taxStatus: "taxable",
  isTaxExempt: false,
  taxExemptionStatus: "NONE",
  resaleCertificateUrl: null,
  taxExemptionRejectionReason: null,
  resaleLicenseNumber: null,
  companyName: "",
  contactName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
  tier: null,
};

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const needsCompletion = searchParams.get("complete") === "1";

  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [companyForm, setCompanyForm] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",
  });
  const [credentialsForm, setCredentialsForm] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [companyMessage, setCompanyMessage] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [credentialsMessage, setCredentialsMessage] = useState<string | null>(null);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const applyProfile = useCallback((nextProfile: UserProfile) => {
    setProfile(nextProfile);
    setCompanyForm({
      companyName: nextProfile.companyName,
      contactName: nextProfile.contactName,
      phone: nextProfile.phone,
      addressLine1: nextProfile.addressLine1,
      addressLine2: nextProfile.addressLine2,
      city: nextProfile.city,
      state: nextProfile.state,
      postalCode: nextProfile.postalCode,
      country: nextProfile.country,
    });
    setCredentialsForm((current) => ({
      ...current,
      email: nextProfile.email,
    }));
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/account/profile");

      if (response.status === 401) {
        router.replace("/login?redirect=/account");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load account profile");
      }

      const data = (await response.json()) as { profile: UserProfile };

      if (data.profile.role === "admin") {
        router.replace("/admin");
        return;
      }

      applyProfile(data.profile);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load account profile"
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyProfile, router]);

  useDeferredEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateCompanyField = (field: keyof typeof companyForm, value: string) => {
    setCompanyForm((current) => ({ ...current, [field]: value }));
  };

  const updateCredentialsField = (
    field: keyof typeof credentialsForm,
    value: string
  ) => {
    setCredentialsForm((current) => ({ ...current, [field]: value }));
  };

  const handleCompanySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingCompany(true);
    setCompanyMessage(null);
    setCompanyError(null);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyForm),
      });

      const data = (await response.json()) as {
        error?: string;
        profile?: UserProfile;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save company details");
      }

      if (data.profile) {
        applyProfile(data.profile);
      }

      setCompanyMessage(
        data.profile && isProfileCompleteForOrdering(data.profile)
          ? "Company details saved. You can now return to the catalog and place your order."
          : "Company details saved."
      );
    } catch (error) {
      setCompanyError(
        error instanceof Error ? error.message : "Failed to save company details"
      );
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingCredentials(true);
    setCredentialsMessage(null);
    setCredentialsError(null);

    const emailChanged = credentialsForm.email.trim() !== profile.email;
    const passwordChanged = credentialsForm.newPassword.length > 0;

    if (!emailChanged && !passwordChanged) {
      setCredentialsError("Change your email and/or password before saving.");
      setIsSavingCredentials(false);
      return;
    }

    if (passwordChanged && credentialsForm.newPassword !== credentialsForm.confirmNewPassword) {
      setCredentialsError("New passwords do not match.");
      setIsSavingCredentials(false);
      return;
    }

    try {
      const response = await fetch("/api/account/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailChanged ? credentialsForm.email.trim() : undefined,
          currentPassword: credentialsForm.currentPassword,
          newPassword: passwordChanged ? credentialsForm.newPassword : undefined,
          confirmNewPassword: passwordChanged
            ? credentialsForm.confirmNewPassword
            : undefined,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        profile?: UserProfile;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update account details");
      }

      if (data.profile) {
        applyProfile(data.profile);
      }

      setCredentialsForm((current) => ({
        email: data.profile?.email ?? current.email,
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      }));
      setCredentialsMessage("Account login details updated.");
      router.refresh();
    } catch (error) {
      setCredentialsError(
        error instanceof Error ? error.message : "Failed to update account details"
      );
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const missingProfileFields = getMissingProfileFieldsForOrdering(companyForm);
  const profileReadyForOrders = isProfileCompleteForOrdering(companyForm);
  if (isLoading) {
    return <LoadingState fullScreen label="Loading your account..." spinnerSize="lg" />;
  }

  if (loadError) {
    return (
      <div className={`flex min-h-full items-center justify-center px-4 ${ui.catalogPageBg}`}>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{loadError}</p>
          <button
            type="button"
            onClick={loadProfile}
            className={`mt-4 ${ui.btnPrimary}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={ui.catalogPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainerNarrow} py-4`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={ui.eyebrow}>Account</p>
              <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
                <UserIcon size={26} className="text-brand" />
                My Account
              </h1>
              <p className={`mt-1.5 ${ui.bodyMuted}`}>
                Manage your company profile, login, and dealer business settings.
              </p>
            </div>
            <Link href="/catalog" className={`${ui.btnSecondary} shrink-0`}>
              <StoreIcon size={15} />
              Back to catalog
            </Link>
          </div>

          <div className="mt-5">
            <CustomerAccountNav active="account" />
          </div>
        </div>
      </header>

      <main className={`${ui.pageContainerNarrow} space-y-6 py-8`}>
        <AccountOverviewCard
          profile={profile}
          profileReadyForOrders={profileReadyForOrders}
        />

        {needsCompletion && !profileReadyForOrders && (
          <AccountAlert tone="warning" title="Complete your profile to place orders">
            {ORDER_PROFILE_INCOMPLETE_MESSAGE}
            {missingProfileFields.length > 0 && (
              <p className="mt-2 font-medium">Missing: {missingProfileFields.join(", ")}</p>
            )}
          </AccountAlert>
        )}

        {isWelcome && (
          <AccountAlert tone="info" title="Welcome to Cabinetto Pro">
            Add your company details below so we can prepare quotes and orders for your projects.
          </AccountAlert>
        )}

        <div className="grid gap-6 xl:grid-cols-12">
          <section className={`p-6 xl:col-span-7 ${ui.catalogCard}`}>
            <AccountSectionHeader
              icon={<StoreIcon size={20} />}
              title="Company details"
              description="Your default billing company and contact information. Job-site delivery addresses are managed separately."
            />

            <form onSubmit={handleCompanySubmit} className="mt-6 space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-cream/55">
                  Contact
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className={ui.fieldLabel}>Company name</span>
                    <input
                      required
                      value={companyForm.companyName}
                      onChange={(event) =>
                        updateCompanyField("companyName", event.target.value)
                      }
                      placeholder="Acme Kitchens LLC"
                      className={ui.input}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className={ui.fieldLabel}>Contact name</span>
                    <input
                      required
                      value={companyForm.contactName}
                      onChange={(event) =>
                        updateCompanyField("contactName", event.target.value)
                      }
                      placeholder="Jane Smith"
                      className={ui.input}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className={ui.fieldLabel}>Phone</span>
                    <input
                      required
                      value={companyForm.phone}
                      onChange={(event) => updateCompanyField("phone", event.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className={ui.input}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-200/80 pt-6 dark:border-zinc-700/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-cream/55">
                    Billing address
                  </p>
                  <Link
                    href="/account/shipping-addresses"
                    className="text-xs font-semibold text-brand underline underline-offset-2"
                  >
                    Manage shipping addresses
                  </Link>
                </div>

                <label className="block space-y-1.5">
                  <span className={ui.fieldLabel}>Address line 1</span>
                  <input
                    required
                    value={companyForm.addressLine1}
                    onChange={(event) =>
                      updateCompanyField("addressLine1", event.target.value)
                    }
                    placeholder="123 Main Street"
                    className={ui.input}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className={ui.fieldLabel}>Address line 2</span>
                  <input
                    value={companyForm.addressLine2}
                    onChange={(event) =>
                      updateCompanyField("addressLine2", event.target.value)
                    }
                    placeholder="Suite 200 (optional)"
                    className={ui.input}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className={ui.fieldLabel}>City</span>
                    <input
                      required
                      value={companyForm.city}
                      onChange={(event) => updateCompanyField("city", event.target.value)}
                      className={ui.input}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={ui.fieldLabel}>State / Province</span>
                    <input
                      required
                      value={companyForm.state}
                      onChange={(event) => updateCompanyField("state", event.target.value)}
                      className={ui.input}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={ui.fieldLabel}>Postal code</span>
                    <input
                      required
                      value={companyForm.postalCode}
                      onChange={(event) =>
                        updateCompanyField("postalCode", event.target.value)
                      }
                      className={ui.input}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={ui.fieldLabel}>Country</span>
                    <input
                      required
                      value={companyForm.country}
                      onChange={(event) => updateCompanyField("country", event.target.value)}
                      className={ui.input}
                    />
                  </label>
                </div>
              </div>

              {companyMessage && (
                <p className="rounded-xl bg-navy/5 px-4 py-3 text-sm text-navy dark:bg-cream/10 dark:text-cream">
                  {companyMessage}
                </p>
              )}
              {companyError && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {companyError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSavingCompany}
                className={`${ui.btnPrimary} w-full py-3 sm:w-auto sm:min-w-[220px]`}
              >
                {isSavingCompany ? "Saving..." : "Save company details"}
              </button>
            </form>
          </section>

          <section className={`p-6 xl:col-span-5 xl:sticky xl:top-24 xl:self-start ${ui.catalogCard}`}>
            <AccountSectionHeader
              icon={<KeyIcon size={20} />}
              title="Login & security"
              description="Update your sign-in email or password. Your current password is required for any change."
            />

            <form onSubmit={handleCredentialsSubmit} className="mt-6 space-y-4">
              <label className="block space-y-1.5">
                <span className={ui.fieldLabel}>Email</span>
                <input
                  type="email"
                  required
                  value={credentialsForm.email}
                  onChange={(event) => updateCredentialsField("email", event.target.value)}
                  className={ui.input}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={ui.fieldLabel}>Current password</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={credentialsForm.currentPassword}
                  onChange={(event) =>
                    updateCredentialsField("currentPassword", event.target.value)
                  }
                  className={ui.input}
                />
              </label>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-zinc-700/50 dark:bg-navy-hover/30">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-cream/55">
                  Change password
                </p>
                <div className="mt-3 space-y-4">
                  <label className="block space-y-1.5">
                    <span className={ui.fieldLabel}>New password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={credentialsForm.newPassword}
                      onChange={(event) =>
                        updateCredentialsField("newPassword", event.target.value)
                      }
                      placeholder="Leave blank to keep current password"
                      className={ui.input}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className={ui.fieldLabel}>Confirm new password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={credentialsForm.confirmNewPassword}
                      onChange={(event) =>
                        updateCredentialsField("confirmNewPassword", event.target.value)
                      }
                      className={ui.input}
                    />
                  </label>
                </div>
              </div>

              {credentialsMessage && (
                <p className="rounded-xl bg-navy/5 px-4 py-3 text-sm text-navy dark:bg-cream/10 dark:text-cream">
                  {credentialsMessage}
                </p>
              )}
              {credentialsError && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {credentialsError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSavingCredentials}
                className={`${ui.btnSecondary} w-full py-3`}
              >
                {isSavingCredentials ? "Updating..." : "Update login details"}
              </button>
            </form>
          </section>
        </div>

        <div className="space-y-4">
          <div>
            <p className={ui.eyebrow}>Business settings</p>
            <h2 className={`mt-1 ${ui.heading2}`}>Quotes & tax exemption</h2>
            <p className={`mt-1.5 ${ui.bodyMuted}`}>
              Brand your client-facing PDFs and manage Texas resale certificate status.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <QuoteBrandingPanel />
            <TaxExemptionPanel profile={profile} onProfileUpdated={applyProfile} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={<LoadingState fullScreen label="Loading account..." spinnerSize="lg" />}
    >
      <AccountContent />
    </Suspense>
  );
}
