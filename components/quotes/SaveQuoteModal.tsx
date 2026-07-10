"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";
import { QUOTE_NAME_MAX_LENGTH } from "@/lib/quote-validation";

type SaveQuoteModalProps = {
  open: boolean;
  loading?: boolean;
  onConfirm: (quoteName: string) => void;
  onCancel: () => void;
};

export function SaveQuoteModal({
  open,
  loading = false,
  onConfirm,
  onCancel,
}: SaveQuoteModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const [quoteName, setQuoteName] = useState("");

  useDeferredEffect(() => {
    if (!open) {
      setQuoteName("");
    }
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = quoteName.trim();

    if (trimmed.length >= 2) {
      onConfirm(trimmed);
    }
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
        className={`w-full max-w-md p-6 shadow-xl ${ui.adminCard}`}
      >
        <h2 id={titleId} className={ui.heading2}>
          Save as Quote
        </h2>
        <p id={descriptionId} className={`mt-2 ${ui.bodyMuted}`}>
          Enter a name for this project or quote draft. You can reload it later from My Quotes.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label htmlFor={inputId} className={`block ${ui.fieldLabel}`}>
            Project / quote name
          </label>
          <input
            id={inputId}
            type="text"
            value={quoteName}
            onChange={(event) => setQuoteName(event.target.value)}
            maxLength={QUOTE_NAME_MAX_LENGTH}
            placeholder='e.g. "John Smith Kitchen Project"'
            autoFocus
            disabled={loading}
            className={ui.input}
          />

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} disabled={loading} className={ui.btnSecondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || quoteName.trim().length < 2}
              className={ui.btnPrimary}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" variant="light" />
                  Saving...
                </>
              ) : (
                "Save quote"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
