"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon } from "@/components/ui/Icon";

type ToastProps = {
  message: string;
  description?: string;
  variant?: "success" | "error";
  durationMs?: number;
  onClose?: () => void;
};

export function Toast({
  message,
  description,
  variant = "success",
  durationMs = 4500,
  onClose,
}: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = setTimeout(() => setIsLeaving(true), durationMs - 350);
    const hideTimer = setTimeout(() => {
      onClose?.();
    }, durationMs);

    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(hideTimer);
    };
  }, [durationMs, message, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-4 z-50 max-w-md sm:right-6 ${
        isLeaving ? "animate-cart-toast-out" : "animate-cart-toast-in"
      }`}
    >
      <div
        className={`flex items-start gap-3 rounded-2xl border p-4 shadow-lg ${
          variant === "success"
            ? "border-brand/20 bg-surface dark:border-brand/30 dark:bg-navy"
            : "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            variant === "success"
              ? "bg-brand-light text-brand"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          <CheckCircleIcon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold ${
              variant === "success" ? "text-navy dark:text-cream" : "text-red-800 dark:text-red-300"
            }`}
          >
            {message}
          </p>
          {description && (
            <p
              className={`mt-1 text-sm ${
                variant === "success"
                  ? "text-muted dark:text-cream/70"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
