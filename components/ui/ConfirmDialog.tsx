"use client";

import { useEffect, useId } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ui } from "@/lib/ui-classes";

export type ConfirmDialogTone = "default" | "danger" | "warning";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: "default" | "danger";
  tone?: ConfirmDialogTone;
  onConfirm: () => void;
  onCancel: () => void;
};

function DialogIcon({ tone }: { tone: ConfirmDialogTone }) {
  if (tone === "danger") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
    );
  }

  if (tone === "warning") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25v3.75M14 11.25v3.75M5.625 7.5h12.75M9.75 7.5V5.625A1.125 1.125 0 0 1 10.875 4.5h2.25A1.125 1.125 0 0 1 14.25 5.625V7.5"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
      />
    </svg>
  );
}

function toneStyles(tone: ConfirmDialogTone) {
  switch (tone) {
    case "danger":
      return {
        iconWrap:
          "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
        confirm:
          "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-400 dark:bg-red-600 dark:hover:bg-red-500",
      };
    case "warning":
      return {
        iconWrap:
          "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        confirm:
          "bg-amber-600 text-white hover:bg-amber-500 disabled:bg-amber-400 dark:bg-amber-600 dark:hover:bg-amber-500",
      };
    default:
      return {
        iconWrap:
          "bg-brand-light text-brand dark:bg-brand-light dark:text-brand",
        confirm:
          "bg-brand text-white hover:bg-brand-hover disabled:opacity-50 dark:disabled:bg-brand/60",
      };
  }
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  variant = "default",
  tone,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const resolvedTone: ConfirmDialogTone =
    tone ?? (variant === "danger" ? "danger" : "default");
  const styles = toneStyles(resolvedTone);

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [loading, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition"
        onClick={loading ? undefined : onCancel}
        disabled={loading}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`relative w-full max-w-md p-6 shadow-2xl ${ui.adminCard}`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.iconWrap}`}
          >
            <DialogIcon tone={resolvedTone} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className={ui.heading3}>
              {title}
            </h2>
            <p id={descriptionId} className={`mt-2 ${ui.bodyMuted}`}>
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={ui.btnSecondary}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles.confirm}`}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" variant="light" />
                Please wait...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
