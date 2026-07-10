"use client";

import { FormEvent, useState } from "react";
import { CERTIFICATE_OF_EXEMPTION_URL } from "@/lib/dealer-application";
import { ui } from "@/lib/ui-classes";
import {
  TAX_EXEMPTION_STATUS_LABELS,
  type TaxExemptionStatus,
} from "@/types/tax-exemption";
import type { UserProfile } from "@/types/account";

type TaxExemptionPanelProps = {
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
};

function statusMessage(status: TaxExemptionStatus, isTaxExempt: boolean) {
  if (isTaxExempt && status === "APPROVED") {
    return "Your Texas resale certificate is approved. Sales tax is not applied to your orders.";
  }

  if (status === "PENDING") {
    return "Your certificate is under review. Sales tax will apply until approved.";
  }

  if (status === "REJECTED") {
    return "Your previous certificate was rejected. Upload an updated document to request review again.";
  }

  return "Upload your Texas resale certificate to request sales tax exemption after admin review.";
}

export function TaxExemptionPanel({ profile, onProfileUpdated }: TaxExemptionPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!file) {
      setError("Choose a resale certificate file before uploading.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("certificate", file);

      const response = await fetch("/api/account/tax-exemption", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
        profile?: UserProfile;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to upload resale certificate");
      }

      if (data.profile) {
        onProfileUpdated(data.profile);
      }

      setFile(null);
      setMessage(
        data.message ??
          "Your certificate is under review. Sales tax will apply until approved."
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Failed to upload resale certificate"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const canUpload =
    profile.taxExemptionStatus === "NONE" ||
    profile.taxExemptionStatus === "REJECTED" ||
    (profile.taxExemptionStatus === "PENDING" && !profile.resaleCertificateUrl);

  return (
    <section className={`p-6 ${ui.catalogCard}`}>
      <h2 className={ui.heading3}>Tax Exemption / Resale Certificate</h2>
      <p className={`mt-2 ${ui.bodyMuted}`}>
        Texas dealers may submit a valid resale certificate for tax-exempt purchasing after
        admin approval.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${ui.cardMuted}`}>
          {TAX_EXEMPTION_STATUS_LABELS[profile.taxExemptionStatus]}
        </span>
        {profile.isTaxExempt && (
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Tax exempt
          </span>
        )}
      </div>

      <p
        className={`mt-4 rounded-xl px-4 py-3 text-sm ${
          profile.taxExemptionStatus === "PENDING"
            ? "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
            : profile.isTaxExempt
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200"
              : ui.cardMuted
        }`}
      >
        {statusMessage(profile.taxExemptionStatus, profile.isTaxExempt)}
      </p>

      {profile.taxExemptionRejectionReason && profile.taxExemptionStatus === "REJECTED" && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">
          Rejection reason: {profile.taxExemptionRejectionReason}
        </p>
      )}

      {canUpload ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className={ui.fieldLabel}>Resale certificate file</span>
            <input
              id="resale-certificate-file"
              type="file"
              accept=".jpeg,.jpg,.png,.pdf,.doc,.docx,image/jpeg,image/png,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <label
              htmlFor="resale-certificate-file"
              className={`inline-flex cursor-pointer ${ui.btnOutlineBrand}`}
            >
              Choose certificate file
            </label>
            <p className={`text-xs ${ui.bodyMuted}`}>
              {file?.name ?? "Accepted formats: jpeg, jpg, png, pdf, doc, docx (max 10 MB)"}
            </p>
          </label>

          <a
            href={CERTIFICATE_OF_EXEMPTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-sm font-medium text-brand underline underline-offset-2"
          >
            Download Texas resale certificate form
          </a>

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

          <button type="submit" disabled={isUploading} className={`${ui.btnPrimary} py-3`}>
            {isUploading ? "Uploading..." : "Submit for review"}
          </button>
        </form>
      ) : (
        <p className={`mt-6 text-sm ${ui.bodyMuted}`}>
          {profile.taxExemptionStatus === "APPROVED"
            ? "Your approved certificate is on file."
            : "Your submitted certificate is awaiting admin review."}
        </p>
      )}
    </section>
  );
}
