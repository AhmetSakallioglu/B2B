"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminButton } from "@/components/admin/admin-ui";
import { LoadingState } from "@/components/ui/LoadingState";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatDate } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { TaxExemptionReviewItem } from "@/types/tax-exemption";

export function AdminTaxExemptionsPanel() {
  const [reviews, setReviews] = useState<TaxExemptionReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [rejectUserId, setRejectUserId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/tax-exemptions");

      if (!response.ok) {
        throw new Error("Failed to load pending tax exemption reviews");
      }

      const data = (await response.json()) as { reviews: TaxExemptionReviewItem[] };
      setReviews(data.reviews);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load reviews");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const reviewDecision = async (userId: number, decision: "approve" | "reject", reason?: string) => {
    setActionUserId(userId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/approve-tax`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to review tax exemption");
      }

      setReviews((current) => current.filter((review) => review.userId !== userId));
      setMessage(
        decision === "approve"
          ? "Tax exemption approved."
          : "Tax exemption rejected and dealer notified."
      );
      setRejectUserId(null);
      setRejectReason("");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Failed to review");
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <AdminShell
      title="Tax exemption reviews"
      subtitle="Review Texas resale certificates and approve or reject dealer tax-exempt status."
      wide
    >
      <div className={`mb-6 ${ui.adminCard} px-5 py-4`}>
        <Link href="/admin/users" className={ui.btnSecondary}>
          Back to users
        </Link>
      </div>

      {message && <div className={`mb-6 px-4 py-3 text-sm ${ui.cardMuted}`}>{message}</div>}

      {isLoading ? (
        <LoadingState label="Loading pending certificates..." minHeight="min-h-[320px]" spinnerSize="lg" />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button type="button" onClick={() => void loadReviews()} className={`mt-4 ${ui.btnPrimary}`}>
            Retry
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className={`px-6 py-12 text-center ${ui.emptyState}`}>
          <p className="text-base font-semibold text-slate-900 dark:text-cream">
            No pending tax exemption certificates
          </p>
        </div>
      ) : (
        <div className={`overflow-hidden ${ui.adminCard}`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={ui.tableHead}>
                <tr>
                  <th className={ui.tableHeadCell}>Dealer</th>
                  <th className={ui.tableHeadCell}>Contact</th>
                  <th className={ui.tableHeadCell}>Resale license</th>
                  <th className={ui.tableHeadCell}>Submitted</th>
                  <th className={ui.tableHeadCell}>Certificate</th>
                  <th className={ui.tableHeadCell} />
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.userId} className={ui.tableRow}>
                    <td className={ui.tableCell}>
                      <p className="font-semibold text-slate-900 dark:text-cream">
                        {review.companyName || review.contactName || review.email}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-cream/60">{review.email}</p>
                    </td>
                    <td className={ui.tableCell}>
                      {review.contactName || "—"}
                      {review.phone && (
                        <p className="text-xs text-slate-500 dark:text-cream/60">{review.phone}</p>
                      )}
                    </td>
                    <td className={ui.tableCell}>{review.resaleLicenseNumber || "—"}</td>
                    <td className={ui.tableCell}>
                      {review.submittedAt ? formatDate(review.submittedAt) : "—"}
                    </td>
                    <td className={ui.tableCell}>
                      <a
                        href={`/api/admin/users/${review.userId}/tax-document`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand underline underline-offset-2"
                      >
                        View PDF
                      </a>
                    </td>
                    <td className={`${ui.tableCell} text-right`}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <AdminButton
                          type="button"
                          disabled={actionUserId === review.userId}
                          onClick={() => void reviewDecision(review.userId, "approve")}
                        >
                          {actionUserId === review.userId ? "Saving..." : "Approve"}
                        </AdminButton>
                        <button
                          type="button"
                          className={`${ui.btnSecondary} px-3 py-1.5 text-xs`}
                          onClick={() => {
                            setRejectUserId(review.userId);
                            setRejectReason("");
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rejectUserId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close reject dialog"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={() => setRejectUserId(null)}
          />
          <div className={`relative z-10 w-full max-w-lg overflow-hidden ${ui.adminCard} shadow-2xl`}>
            <div className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
              <h2 className={ui.heading2}>Reject tax exemption</h2>
            </div>
            <div className="space-y-4 px-5 py-5 sm:px-6">
              <label className="block space-y-1.5">
                <span className={ui.fieldLabel}>Reason (optional)</span>
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={4}
                  className={`${ui.input} min-h-[120px]`}
                  placeholder="Explain what needs to be corrected on the certificate."
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
              <AdminButton type="button" onClick={() => setRejectUserId(null)}>
                Cancel
              </AdminButton>
              <button
                type="button"
                className={`${ui.btnSecondary} border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300`}
                disabled={actionUserId === rejectUserId}
                onClick={() => void reviewDecision(rejectUserId, "reject", rejectReason)}
              >
                {actionUserId === rejectUserId ? "Rejecting..." : "Confirm reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
