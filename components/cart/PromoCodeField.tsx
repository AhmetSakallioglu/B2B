"use client";

import { FormEvent, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatPromoExpiryShort } from "@/lib/promo-display";
import { ui } from "@/lib/ui-classes";
import type { AppliedPromoSummary } from "@/types/promo-code";
import { useCartStore } from "@/store/useCartStore";

type PromoCodeFieldProps = {
  disabled?: boolean;
  onApplied?: (promo: AppliedPromoSummary) => void;
  onError?: (message: string) => void;
};

export function PromoCodeField({ disabled = false, onApplied, onError }: PromoCodeFieldProps) {
  const [code, setCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const appliedPromo = useCartStore((state) => state.appliedPromo);
  const setAppliedPromo = useCartStore((state) => state.setAppliedPromo);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!code.trim() || isApplying || disabled) {
      return;
    }

    setIsApplying(true);

    try {
      const response = await fetch("/api/cart/apply-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = (await response.json()) as {
        promo?: AppliedPromoSummary;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to apply promo code");
      }

      if (!data.promo) {
        throw new Error("Failed to apply promo code");
      }

      setAppliedPromo(data.promo);
      setCode(data.promo.code);
      onApplied?.(data.promo);
    } catch (applyError) {
      setAppliedPromo(null);
      onError?.(
        applyError instanceof Error ? applyError.message : "Failed to apply promo code"
      );
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemove = () => {
    setAppliedPromo(null);
    setCode("");
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white px-4 py-4 dark:border-zinc-700/50 dark:bg-navy">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-cream">Promo code</p>
        {appliedPromo && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs font-medium text-slate-500 transition hover:text-red-600 dark:text-cream/60 dark:hover:text-red-400"
          >
            Remove
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="CAB-XXXX-XX"
          disabled={disabled || isApplying}
          className={`${ui.input} min-w-0 flex-1 uppercase`}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={disabled || isApplying || !code.trim()}
          className={`${ui.btnSecondary} shrink-0 px-4`}
        >
          {isApplying ? <LoadingSpinner size="sm" /> : "Apply"}
        </button>
      </form>

      {appliedPromo && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          {appliedPromo.code} applied —{" "}
          {appliedPromo.discountType === "percentage"
            ? `${appliedPromo.discountValue}% off`
            : `${appliedPromo.discountValue.toFixed(2)} off`}{" "}
          (expires {formatPromoExpiryShort(appliedPromo.expiresAt)})
        </p>
      )}
    </div>
  );
}
