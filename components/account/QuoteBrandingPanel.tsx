"use client";

import Link from "next/link";
import { FormEvent, useCallback, useRef, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { CUSTOM_FOOTER_MAX_LENGTH } from "@/lib/client-quote-validation";
import { ui } from "@/lib/ui-classes";

type QuoteBranding = {
  companyName: string;
  companyLogoUrl: string | null;
  customQuoteFooterText: string | null;
};

export function QuoteBrandingPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<QuoteBranding | null>(null);
  const [footerText, setFooterText] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBranding = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account/quote-branding");

      if (!response.ok) {
        throw new Error("Failed to load client quote branding");
      }

      const data = (await response.json()) as { branding: QuoteBranding };
      setBranding(data.branding);
      setFooterText(data.branding.customQuoteFooterText ?? "");
      setLogoPreview(data.branding.companyLogoUrl);
      setLogoFile(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load client quote branding"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  const handleLogoChange = (file: File | null) => {
    setLogoFile(file);
    setMessage(null);
    setError(null);

    if (!file) {
      setLogoPreview(branding?.companyLogoUrl ?? null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const footerChanged =
      footerText.trim() !== (branding?.customQuoteFooterText ?? "").trim();

    if (!logoFile && !footerChanged) {
      setError("Choose a new logo or update the footer text before saving.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();

      if (logoFile) {
        formData.set("companyLogo", logoFile);
      }

      if (footerChanged) {
        formData.set("customQuoteFooterText", footerText.trim());
      }

      const response = await fetch("/api/account/quote-branding", {
        method: "PATCH",
        body: formData,
      });

      const data = (await response.json()) as {
        error?: string;
        branding?: QuoteBranding;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save quote branding");
      }

      if (data.branding) {
        setBranding(data.branding);
        setFooterText(data.branding.customQuoteFooterText ?? "");
        setLogoPreview(data.branding.companyLogoUrl);
        setLogoFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }

      setMessage("Client quote branding saved. It will appear on your next PDF export.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save quote branding");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className={`p-6 ${ui.catalogCard}`}>
        <LoadingSpinner size="sm" />
        <p className={`mt-3 text-sm ${ui.bodyMuted}`}>Loading client quote branding...</p>
      </section>
    );
  }

  return (
    <section className={`p-6 ${ui.catalogCard}`}>
      <h2 className={ui.heading3}>Client quote branding</h2>
      <p className={`mt-2 ${ui.bodyMuted}`}>
        Upload your company logo and default footer for white-label PDF quotes sent to your
        clients. Your markup and Cabinetto pricing are never shown on these PDFs.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p className={ui.fieldLabel}>Company logo</p>
          <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
            PNG or JPG, up to 2 MB. Shown at the top of client quote PDFs
            {branding?.companyName ? ` for ${branding.companyName}` : ""}.
          </p>

          {logoPreview && (
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 dark:border-zinc-700/50 dark:bg-navy-hover/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview}
                alt="Company logo preview"
                className="h-14 max-w-[200px] object-contain"
              />
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              ref={fileInputRef}
              id="quote-branding-logo-file"
              type="file"
              accept="image/png,image/jpeg"
              disabled={isSaving}
              onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <label
              htmlFor="quote-branding-logo-file"
              aria-disabled={isSaving}
              className={`${ui.btnSecondary} cursor-pointer ${isSaving ? "pointer-events-none opacity-50" : ""}`}
            >
              Choose logo file
            </label>
            <span className={`text-sm ${ui.bodyMuted}`}>
              {logoFile?.name ?? "PNG or JPG, up to 2 MB"}
            </span>
            {logoFile && (
              <button
                type="button"
                disabled={isSaving}
                className={ui.btnGhost}
                onClick={() => {
                  handleLogoChange(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                Clear selection
              </button>
            )}
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className={ui.fieldLabel}>Default quote footer</span>
          <textarea
            value={footerText}
            onChange={(event) => setFooterText(event.target.value)}
            maxLength={CUSTOM_FOOTER_MAX_LENGTH}
            rows={3}
            disabled={isSaving}
            placeholder="Thank you for your business. Quote valid for 30 days."
            className={ui.input}
          />
        </label>

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

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isSaving} className={ui.btnPrimary}>
            {isSaving ? (
              <>
                <LoadingSpinner size="sm" variant="light" />
                Saving...
              </>
            ) : (
              "Save quote branding"
            )}
          </button>
          <Link
            href="/cart"
            className={`text-sm font-semibold text-brand underline underline-offset-2`}
          >
            Back to cart to generate a quote
          </Link>
        </div>
      </form>
    </section>
  );
}
