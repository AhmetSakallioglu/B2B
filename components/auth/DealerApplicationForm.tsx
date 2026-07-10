"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useState, type ReactNode } from "react";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { ArrowLeftIcon, LogInIcon, UserPlusIcon } from "@/components/ui/Icon";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LoadingState } from "@/components/ui/LoadingState";
import { ui } from "@/lib/ui-classes";
import {
  BUSINESS_TYPE_OPTIONS,
  CERTIFICATE_OF_EXEMPTION_URL,
  DEALER_FORM_GRID_CLASS,
  DEALER_FORM_INPUT_CLASS,
  DEALER_FORM_LABEL_CLASS,
  DEALER_TERMS_TEXT,
  EXPECTED_MONTHLY_SALES_OPTIONS,
  TAX_STATUS_LABELS,
  type TaxStatus,
} from "@/lib/dealer-application";
import { validatePassword } from "@/lib/password-policy";
import { executeRecaptchaV3, isRecaptchaV3Configured } from "@/lib/recaptcha-client";
import { readJsonResponse } from "@/lib/fetch-json";
import { sanitizeRedirectUrl } from "@/lib/security-utils";
import { DEFAULT_COUNTRY, US_STATES } from "@/lib/us-states";
import type { RegisterSuccessResponse } from "@/types/auth";

type AddressForm = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

const EMPTY_ADDRESS = (): AddressForm => ({
  firstName: "",
  lastName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: DEFAULT_COUNTRY,
  phone: "",
});

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className={`p-6 sm:p-8 ${ui.catalogCard}`}>
      <div className="border-b border-slate-200/80 pb-4 dark:border-zinc-700/50">
        <h2 className={ui.heading3}>{title}</h2>
        {description && (
          <p className={`mt-1 ${ui.bodyMuted}`}>{description}</p>
        )}
      </div>
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
};

type AddressFieldsProps = {
  prefix: string;
  values: AddressForm;
  onChange: (field: keyof AddressForm, value: string) => void;
  disabled?: boolean;
};

function AddressFields({ prefix, values, onChange, disabled = false }: AddressFieldsProps) {
  const fieldId = (name: keyof AddressForm) => `${prefix}-${name}`;

  return (
    <div className={DEALER_FORM_GRID_CLASS}>
      <label className="block space-y-1.5">
        <span className={DEALER_FORM_LABEL_CLASS}>First Name *</span>
        <input
          id={fieldId("firstName")}
          required={!disabled}
          disabled={disabled}
          value={values.firstName}
          onChange={(event) => onChange("firstName", event.target.value)}
          className={DEALER_FORM_INPUT_CLASS}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={DEALER_FORM_LABEL_CLASS}>Last Name *</span>
        <input
          id={fieldId("lastName")}
          required={!disabled}
          disabled={disabled}
          value={values.lastName}
          onChange={(event) => onChange("lastName", event.target.value)}
          className={DEALER_FORM_INPUT_CLASS}
        />
      </label>

      <label className="block space-y-1.5 sm:col-span-2">
        <span className={DEALER_FORM_LABEL_CLASS}>Address Line 1 *</span>
        <input
          id={fieldId("addressLine1")}
          required={!disabled}
          disabled={disabled}
          value={values.addressLine1}
          onChange={(event) => onChange("addressLine1", event.target.value)}
          className={DEALER_FORM_INPUT_CLASS}
        />
      </label>

      <label className="block space-y-1.5 sm:col-span-2">
        <span className={DEALER_FORM_LABEL_CLASS}>Address Line 2</span>
        <input
          id={fieldId("addressLine2")}
          disabled={disabled}
          value={values.addressLine2}
          onChange={(event) => onChange("addressLine2", event.target.value)}
          className={DEALER_FORM_INPUT_CLASS}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={DEALER_FORM_LABEL_CLASS}>City *</span>
        <input
          id={fieldId("city")}
          required={!disabled}
          disabled={disabled}
          value={values.city}
          onChange={(event) => onChange("city", event.target.value)}
          className={DEALER_FORM_INPUT_CLASS}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={DEALER_FORM_LABEL_CLASS}>State *</span>
        <select
          id={fieldId("state")}
          required={!disabled}
          disabled={disabled}
          value={values.state}
          onChange={(event) => onChange("state", event.target.value)}
          className={`${DEALER_FORM_INPUT_CLASS} appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")",
          }}
        >
          <option value="">Select state</option>
          {US_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className={DEALER_FORM_LABEL_CLASS}>Zip Code *</span>
        <input
          id={fieldId("postalCode")}
          required={!disabled}
          disabled={disabled}
          value={values.postalCode}
          onChange={(event) => onChange("postalCode", event.target.value)}
          className={DEALER_FORM_INPUT_CLASS}
          placeholder="12345 or 12345-6789"
        />
      </label>

      <label className="block space-y-1.5">
        <span className={DEALER_FORM_LABEL_CLASS}>Country *</span>
        <input
          id={fieldId("country")}
          disabled
          value={DEFAULT_COUNTRY}
          className={`${DEALER_FORM_INPUT_CLASS} cursor-not-allowed opacity-70`}
        />
      </label>

      <label className="block space-y-1.5 sm:col-span-2">
        <span className={DEALER_FORM_LABEL_CLASS}>Phone Number *</span>
        <input
          id={fieldId("phone")}
          type="tel"
          required={!disabled}
          disabled={disabled}
          value={values.phone}
          onChange={(event) => onChange("phone", event.target.value)}
          className={DEALER_FORM_INPUT_CLASS}
          placeholder="(555) 555-5555"
        />
      </label>
    </div>
  );
}

function DealerApplicationFormInner() {
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectUrl(searchParams.get("redirect"));
  const recaptchaConfigured = isRecaptchaV3Configured();

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fax, setFax] = useState("");
  const [billing, setBilling] = useState<AddressForm>(EMPTY_ADDRESS);
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(false);
  const [shipping, setShipping] = useState<AddressForm>(EMPTY_ADDRESS);
  const [federalTaxId, setFederalTaxId] = useState("");
  const [taxStatus, setTaxStatus] = useState<TaxStatus>("taxable");
  const [businessType, setBusinessType] = useState("");
  const [expectedMonthlySales, setExpectedMonthlySales] = useState("");
  const [salesTaxAccount, setSalesTaxAccount] = useState("");
  const [hasResaleLicense, setHasResaleLicense] = useState<"yes" | "no" | "">("");
  const [resaleLicenseNumber, setResaleLicenseNumber] = useState("");
  const [taxDocument, setTaxDocument] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateBilling = useCallback(
    (field: keyof AddressForm, value: string) => {
      setBilling((current) => {
        const next = { ...current, [field]: value };
        if (shippingSameAsBilling) {
          setShipping(next);
        }
        return next;
      });
    },
    [shippingSameAsBilling]
  );

  const updateShipping = useCallback((field: keyof AddressForm, value: string) => {
    setShipping((current) => ({ ...current, [field]: value }));
  }, []);

  const handleShippingSameChange = (checked: boolean) => {
    setShippingSameAsBilling(checked);

    if (checked) {
      setShipping({ ...billing });
    } else {
      setShipping(EMPTY_ADDRESS());
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!acceptedTerms) {
      setError("You must accept the Terms and Conditions");
      return;
    }

    if (taxStatus === "exempt") {
      if (!businessType) {
        setError("Select a business type");
        return;
      }

      if (!expectedMonthlySales) {
        setError("Select expected monthly sales");
        return;
      }

      if (!salesTaxAccount.trim()) {
        setError("Sales Tax Account is required for tax-exempt applications");
        return;
      }

      if (!hasResaleLicense) {
        setError("Indicate whether you have a resale license");
        return;
      }

      if (hasResaleLicense === "yes" && !resaleLicenseNumber.trim()) {
        setError("Resale License Number is required");
        return;
      }

      if (!taxDocument) {
        setError("Upload a tax exemption document");
        return;
      }
    }

    const shippingPayload = shippingSameAsBilling ? { ...billing } : { ...shipping };

    setIsSubmitting(true);

    try {
      let recaptchaToken: string | null = null;

      if (recaptchaConfigured) {
        if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
          console.error("reCAPTCHA Site Key Eksik!");
          setError("reCAPTCHA verification failed. Please try again.");
          return;
        }

        try {
          recaptchaToken = await executeRecaptchaV3("register");
        } catch {
          setError("reCAPTCHA verification failed. Please try again.");
          return;
        }

        if (!recaptchaToken) {
          setError("reCAPTCHA verification failed. Please try again.");
          return;
        }
      }

      const payload = {
        companyName,
        phone,
        alternatePhone: alternatePhone || undefined,
        fax: fax || undefined,
        email,
        password,
        confirmPassword,
        billing,
        shippingSameAsBilling,
        shipping: shippingPayload,
        taxStatus,
        federalTaxId,
        businessType: taxStatus === "exempt" ? businessType : undefined,
        expectedMonthlySales: taxStatus === "exempt" ? expectedMonthlySales : undefined,
        salesTaxAccount: taxStatus === "exempt" ? salesTaxAccount : undefined,
        hasResaleLicense:
          taxStatus === "exempt" ? hasResaleLicense === "yes" : undefined,
        resaleLicenseNumber:
          taxStatus === "exempt" && hasResaleLicense === "yes"
            ? resaleLicenseNumber
            : undefined,
        notes: notes || undefined,
        acceptedTerms,
        recaptchaToken,
      };

      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));

      if (taxStatus === "exempt" && taxDocument) {
        formData.append("taxDocument", taxDocument);
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });

      const data = await readJsonResponse<
        RegisterSuccessResponse & { error?: string }
      >(response);

      if (!response.ok) {
        if (data.pendingApproval) {
          setRegisteredEmail(data.email);
          setSuccessMessage(data.message);
          return;
        }

        throw new Error(data.error ?? "Application submission failed");
      }

      setRegisteredEmail(data.email);
      setSuccessMessage(data.message);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Application submission failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <div className={`flex min-h-full items-center justify-center px-4 py-12 ${ui.catalogPageBg}`}>
        <div className={`w-full max-w-lg p-8 ${ui.catalogCard}`}>
          <p className={ui.eyebrow}>Cabinetto Pro</p>
          <h1 className={`mt-2 ${ui.heading1}`}>Application received</h1>
          <p className={`mt-4 ${ui.bodyMuted}`}>
            {successMessage}
          </p>
          {registeredEmail && (
            <p className="mt-3 text-sm text-slate-800 dark:text-cream">
              Registered email: <span className="font-semibold">{registeredEmail}</span>
            </p>
          )}
          <Link
            href={`/login?registered=1&redirect=${encodeURIComponent(redirectTo)}`}
            className={`mt-8 inline-flex w-full items-center justify-center gap-2 ${ui.btnPrimary} py-3`}
          >
            <LogInIcon size={16} />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full px-4 py-10 sm:py-14 ${ui.catalogPageBg}`}>
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/catalog"
          className={`mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-cream/65 dark:hover:text-cream`}
        >
          <ArrowLeftIcon size={16} className="shrink-0" />
          Back to Catalog
        </Link>

        <header className="mb-8 text-center sm:mb-10">
          <p className={ui.eyebrow}>Cabinetto Pro</p>
          <h1 className={`mt-2 flex items-center justify-center gap-2 ${ui.heading1} text-3xl`}>
            <UserPlusIcon size={28} className="text-brand" />
            Dealer Application
          </h1>
          <p className={`mx-auto mt-3 max-w-2xl ${ui.bodyMuted}`}>
            Apply for a B2B dealer account to access pricing, save quotes, and place cabinet
            orders. New applications require administrator approval before first sign-in.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection
            title="Contact Information"
            description="Primary company contact and account credentials."
          >
            <div className={DEALER_FORM_GRID_CLASS}>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className={DEALER_FORM_LABEL_CLASS}>Company Name *</span>
                <input
                  required
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className={DEALER_FORM_INPUT_CLASS}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={DEALER_FORM_LABEL_CLASS}>Phone Number *</span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className={DEALER_FORM_INPUT_CLASS}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={DEALER_FORM_LABEL_CLASS}>Alternate Phone Number</span>
                <input
                  type="tel"
                  value={alternatePhone}
                  onChange={(event) => setAlternatePhone(event.target.value)}
                  className={DEALER_FORM_INPUT_CLASS}
                />
              </label>

              <label className="block space-y-1.5 sm:col-span-2">
                <span className={DEALER_FORM_LABEL_CLASS}>Email *</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={DEALER_FORM_INPUT_CLASS}
                  placeholder="you@company.com"
                />
              </label>

              <label className="block space-y-1.5">
                <span className={DEALER_FORM_LABEL_CLASS}>Password *</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={DEALER_FORM_INPUT_CLASS}
                  placeholder="At least 8 characters with letters and numbers"
                />
                <PasswordStrengthMeter password={password} />
              </label>

              <label className="block space-y-1.5">
                <span className={DEALER_FORM_LABEL_CLASS}>Confirm Password *</span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={DEALER_FORM_INPUT_CLASS}
                />
              </label>

              <label className="block space-y-1.5 sm:col-span-2">
                <span className={DEALER_FORM_LABEL_CLASS}>Fax</span>
                <input
                  type="tel"
                  value={fax}
                  onChange={(event) => setFax(event.target.value)}
                  className={DEALER_FORM_INPUT_CLASS}
                />
              </label>
            </div>
          </FormSection>

          <FormSection
            title="Business Information (Billing)"
            description="Legal billing address and contact for invoices."
          >
            <AddressFields prefix="billing" values={billing} onChange={updateBilling} />
          </FormSection>

          <FormSection
            title="Shipping Information"
            description="Delivery address for merchandise shipments."
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-4 dark:border-brand/30 dark:bg-brand/10">
              <input
                type="checkbox"
                checked={shippingSameAsBilling}
                onChange={(event) => handleShippingSameChange(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-brand-ring"
              />
              <span className="text-sm font-medium text-navy dark:text-cream">
                My billing and shipping address are the same.
              </span>
            </label>

            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${
                shippingSameAsBilling
                  ? "grid-rows-[0fr] opacity-0"
                  : "mt-2 grid-rows-[1fr] opacity-100"
              }`}
            >
              <div className="overflow-hidden">
                <AddressFields
                  prefix="shipping"
                  values={shipping}
                  onChange={updateShipping}
                  disabled={shippingSameAsBilling}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Account Information"
            description="Tax identification and additional notes for your application."
          >
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted dark:text-cream/70">
                Selecting tax-exempt indicates you intend to purchase for resale. Upload your Texas
                resale certificate for admin review. Sales tax applies until exemption is approved.
              </p>
              <div>
                <span className={DEALER_FORM_LABEL_CLASS}>Tax status *</span>
                <div className="mt-3 inline-flex w-full max-w-md rounded-2xl border border-border bg-cream/40 p-1 dark:border-border dark:bg-navy-hover/60">
                  {(["taxable", "exempt"] as const).map((option) => {
                    const isActive = taxStatus === option;

                    return (
                      <label
                        key={option}
                        className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? "bg-brand text-white shadow-sm"
                            : "text-navy/80 hover:bg-surface dark:text-cream/80 dark:hover:bg-navy"
                        }`}
                      >
                        <input
                          type="radio"
                          name="taxStatus"
                          value={option}
                          checked={isActive}
                          onChange={() => {
                            setTaxStatus(option);

                            if (option === "taxable") {
                              setBusinessType("");
                              setExpectedMonthlySales("");
                              setSalesTaxAccount("");
                              setHasResaleLicense("");
                              setResaleLicenseNumber("");
                              setTaxDocument(null);
                            }
                          }}
                          className="sr-only"
                        />
                        {TAX_STATUS_LABELS[option]}
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className={DEALER_FORM_LABEL_CLASS}>
                  US Customer — Federal Tax ID (EIN) *
                </span>
                <input
                  required
                  value={federalTaxId}
                  onChange={(event) => setFederalTaxId(event.target.value)}
                  className={DEALER_FORM_INPUT_CLASS}
                  placeholder="XX-XXXXXXX"
                />
              </label>

              {taxStatus === "exempt" && (
                <div className="space-y-4 rounded-2xl border border-brand/20 bg-brand/5 p-4 dark:border-brand/30 dark:bg-brand/10 sm:p-5">
                  <label className="block space-y-1.5">
                    <span className={DEALER_FORM_LABEL_CLASS}>Business Type *</span>
                    <select
                      required
                      value={businessType}
                      onChange={(event) => setBusinessType(event.target.value)}
                      className={DEALER_FORM_INPUT_CLASS}
                    >
                      <option value="">Select business type</option>
                      {BUSINESS_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={DEALER_FORM_LABEL_CLASS}>Expected Monthly Sales *</span>
                    <select
                      required
                      value={expectedMonthlySales}
                      onChange={(event) => setExpectedMonthlySales(event.target.value)}
                      className={DEALER_FORM_INPUT_CLASS}
                    >
                      <option value="">Select expected monthly sales</option>
                      {EXPECTED_MONTHLY_SALES_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={DEALER_FORM_LABEL_CLASS}>Sales Tax Account *</span>
                    <input
                      required
                      value={salesTaxAccount}
                      onChange={(event) => setSalesTaxAccount(event.target.value)}
                      className={DEALER_FORM_INPUT_CLASS}
                      placeholder="State sales tax account number"
                    />
                  </label>

                  <fieldset className="space-y-3">
                    <legend className={DEALER_FORM_LABEL_CLASS}>Resale License *</legend>
                    <div className="flex flex-wrap gap-4">
                      {(["yes", "no"] as const).map((option) => (
                        <label
                          key={option}
                          className="inline-flex cursor-pointer items-center gap-2 text-sm text-navy dark:text-cream"
                        >
                          <input
                            type="radio"
                            name="hasResaleLicense"
                            value={option}
                            checked={hasResaleLicense === option}
                            onChange={() => {
                              setHasResaleLicense(option);

                              if (option === "no") {
                                setResaleLicenseNumber("");
                              }
                            }}
                            className="h-4 w-4 border-border text-brand focus:ring-brand-ring"
                          />
                          {option === "yes" ? "Yes" : "No"}
                        </label>
                      ))}
                    </div>
                    {hasResaleLicense === "yes" && (
                      <label className="block space-y-1.5">
                        <span className={DEALER_FORM_LABEL_CLASS}>Resale License Number *</span>
                        <input
                          required
                          value={resaleLicenseNumber}
                          onChange={(event) => setResaleLicenseNumber(event.target.value)}
                          className={DEALER_FORM_INPUT_CLASS}
                          placeholder="Enter your resale license number"
                        />
                      </label>
                    )}
                    <p className="text-xs leading-relaxed text-muted dark:text-cream/60">
                      Note: Upload your resale certificate for admin review. Sales tax exemption
                      applies only after approval.
                    </p>
                  </fieldset>

                  <div className="space-y-2">
                    <label className="block space-y-1.5">
                      <span className={DEALER_FORM_LABEL_CLASS}>Tax Document *</span>
                      <input
                        type="file"
                        required
                        accept=".jpeg,.jpg,.png,.pdf,.doc,.docx,image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setTaxDocument(file);
                        }}
                        className={`${DEALER_FORM_INPUT_CLASS} file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-hover`}
                      />
                    </label>
                    <p className="text-xs text-muted dark:text-cream/60">
                      Accepted formats: jpeg, jpg, png, pdf, doc, docx
                    </p>
                    <a
                      href={CERTIFICATE_OF_EXEMPTION_URL}
                      download
                      className="inline-flex rounded-full border border-brand/30 px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand-light"
                    >
                      Download Certificate of Exemption
                    </a>
                  </div>
                </div>
              )}

              <label className="block space-y-1.5">
                <span className={DEALER_FORM_LABEL_CLASS}>Notes</span>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={`${DEALER_FORM_INPUT_CLASS} min-h-[120px] resize-y`}
                  placeholder="Optional details about your business or application..."
                />
              </label>
            </div>
          </FormSection>

          <section className={`p-6 sm:p-8 ${ui.catalogCard}`}>
            <h2 className={ui.heading3}>Terms &amp; Conditions</h2>
            <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-slate-200/60 bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-700 dark:border-zinc-700/50 dark:bg-navy-hover/60 dark:text-cream/85">
              {DEALER_TERMS_TEXT}
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand-ring"
              />
              <span className="text-sm text-slate-800 dark:text-cream">
                I accept the Terms and Conditions listed above. *
              </span>
            </label>
          </section>

          <section className="space-y-4">
            {recaptchaConfigured && (
              <p className="text-xs leading-relaxed text-muted dark:text-cream/60">
                This site is protected by reCAPTCHA and the Google{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a
                  href="https://policies.google.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Terms of Service
                </a>{" "}
                apply.
              </p>
            )}

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[240px] ${ui.btnPrimary} py-3.5`}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" variant="light" />
                  Submitting application...
                </>
              ) : (
                <>
                  <UserPlusIcon size={16} />
                  Submit dealer application
                </>
              )}
            </button>

            <p className="text-center text-sm text-muted dark:text-cream/75">
              Already have a dealer account?{" "}
              <Link
                href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
                className="font-medium text-brand hover:underline"
              >
                Sign In
              </Link>
            </p>
          </section>
        </form>
      </div>
    </div>
  );
}

export function DealerApplicationForm() {
  return (
    <Suspense
      fallback={<LoadingState fullScreen label="Loading dealer application..." spinnerSize="lg" />}
    >
      <DealerApplicationFormInner />
    </Suspense>
  );
}
