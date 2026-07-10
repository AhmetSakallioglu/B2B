"use client";

import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";

type OrderModificationPaymentBannerProps = {
  orderId: number;
  balanceDue: number;
  loading?: boolean;
  onPay: () => void;
};

export function OrderModificationPaymentBanner({
  orderId,
  balanceDue,
  loading = false,
  onPay,
}: OrderModificationPaymentBannerProps) {
  return (
    <div className="rounded-2xl border border-amber-300/80 bg-amber-50 px-5 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">Additional payment required for Order #{orderId}</p>
      <p className="mt-2 text-amber-900 dark:text-amber-200/90">
        An administrator modified this order. Pay the remaining balance of{" "}
        <span className="font-bold">{formatPrice(balanceDue)}</span> before production can continue.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={onPay}
        className={`mt-4 ${ui.btnPrimary}`}
      >
        {loading ? "Opening checkout..." : "Pay modification balance"}
      </button>
    </div>
  );
}
