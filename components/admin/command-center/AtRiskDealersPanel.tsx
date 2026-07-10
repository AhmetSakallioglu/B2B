"use client";

import Link from "next/link";
import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { PhoneIcon, TagIcon, UsersIcon } from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { formatDate, formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { AtRiskDealer, ChurnRadarResponse } from "@/types/churn-radar";

type AtRiskDealersPanelProps = {
  data: ChurnRadarResponse;
  canIssueCoupons: boolean;
  onCouponIssued?: () => void;
};

function riskReasonLabel(reason: AtRiskDealer["riskReasons"][number]) {
  if (reason === "inactive_login") {
    return "No login in 30+ days";
  }

  return "No orders/quotes in 60+ days";
}

export function AtRiskDealersPanel({
  data,
  canIssueCoupons,
  onCouponIssued,
}: AtRiskDealersPanelProps) {
  const [issuingUserId, setIssuingUserId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issueCoupon = async (dealer: AtRiskDealer) => {
    setIssuingUserId(dealer.userId);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/analytics/churn-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dealer.userId,
          discountPercent: 10,
          expiryDays: 30,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        promo?: { code: string };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to issue coupon");
      }

      setFeedback(`Win-back coupon ${payload.promo?.code ?? ""} sent to ${dealer.companyName}.`);
      onCouponIssued?.();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "Failed to issue coupon");
    } finally {
      setIssuingUserId(null);
    }
  };

  return (
    <section className={`p-6 ${ui.adminCard}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`flex items-center gap-2 ${ui.heading3}`}>
            <UsersIcon size={18} className="text-rose-600" />
            At-Risk Dealers
          </h2>
          <p className={`mt-1 ${ui.bodyMuted}`}>
            VIP dealers (LTV over {formatPrice(data.ltvThreshold)}) with churn signals — login or
            order inactivity
          </p>
          <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
            Analytics cache refreshes every 15 minutes
            {data.cachedAt ? ` · Updated ${formatDate(data.cachedAt)}` : ""}
          </p>
        </div>
        <Link
          href="/admin/logs"
          className="text-sm font-medium text-brand underline-offset-2 hover:underline"
        >
          View audit log
        </Link>
      </div>

      {feedback && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-100">
          {feedback}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {data.dealers.length === 0 ? (
        <p className={`${ui.bodyMuted}`}>No VIP dealers are currently flagged for churn risk.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={ui.tableHead}>
              <tr>
                <th className={ui.tableHeadCell}>Dealer</th>
                <th className={ui.tableHeadCell}>LTV</th>
                <th className={ui.tableHeadCell}>Last login</th>
                <th className={ui.tableHeadCell}>Last activity</th>
                <th className={ui.tableHeadCell}>Risk</th>
                <th className={ui.tableHeadCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.dealers.map((dealer) => (
                <tr key={dealer.userId} className={ui.tableRow}>
                  <td className={ui.tableCell}>
                    <p className="font-semibold text-slate-900 dark:text-cream">
                      {dealer.companyName}
                    </p>
                    <p className={`text-xs ${ui.bodyMuted}`}>{dealer.email}</p>
                    {dealer.phone && (
                      <a href={`tel:${dealer.phone}`} className="mt-1 inline-flex text-xs text-brand">
                        {dealer.phone}
                      </a>
                    )}
                  </td>
                  <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                    {formatPrice(dealer.lifetimeValue)}
                    <p className={`text-xs font-normal ${ui.bodyMuted}`}>
                      {dealer.completedOrderCount} completed
                    </p>
                  </td>
                  <td className={`${ui.tableCell} ${ui.bodyMuted}`}>
                    {dealer.lastLoginAt ? formatDate(dealer.lastLoginAt) : "—"}
                    {dealer.daysSinceLogin !== null && (
                      <p className="text-xs">{dealer.daysSinceLogin}d ago</p>
                    )}
                  </td>
                  <td className={`${ui.tableCell} ${ui.bodyMuted}`}>
                    {dealer.lastActivityAt ? formatDate(dealer.lastActivityAt) : "—"}
                    {dealer.daysSinceActivity !== null && (
                      <p className="text-xs">{dealer.daysSinceActivity}d ago</p>
                    )}
                  </td>
                  <td className={ui.tableCell}>
                    <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                      🔴 CHURN RISK
                    </span>
                    <ul className={`mt-2 space-y-0.5 text-xs ${ui.bodyMuted}`}>
                      {dealer.riskReasons.map((reason) => (
                        <li key={reason}>{riskReasonLabel(reason)}</li>
                      ))}
                    </ul>
                  </td>
                  <td className={ui.tableCell}>
                    <div className="flex flex-wrap gap-2">
                      {dealer.phone && (
                        <a
                          href={`tel:${dealer.phone}`}
                          className={`${ui.btnSecondary} px-2.5 py-1.5 text-xs`}
                        >
                          <IconLabel icon={<PhoneIcon size={13} />}>Call</IconLabel>
                        </a>
                      )}
                      <Link
                        href={`/admin/users/${dealer.userId}`}
                        className={`${ui.btnSecondary} px-2.5 py-1.5 text-xs`}
                      >
                        Profile
                      </Link>
                      {canIssueCoupons && (
                        <button
                          type="button"
                          onClick={() => void issueCoupon(dealer)}
                          disabled={issuingUserId === dealer.userId}
                          className={`${ui.btnPrimary} px-2.5 py-1.5 text-xs disabled:opacity-60`}
                        >
                          <IconLabel icon={<TagIcon size={13} />}>
                            {issuingUserId === dealer.userId ? "Issuing..." : "Issue 10% coupon"}
                          </IconLabel>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AtRiskDealersPanelSkeleton() {
  return (
    <section className={`min-h-[320px] space-y-4 p-6 ${ui.adminCard}`} aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-96 max-w-full" />
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </section>
  );
}
