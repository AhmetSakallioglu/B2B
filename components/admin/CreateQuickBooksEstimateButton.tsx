"use client";

import { useState } from "react";
import { CheckCircleIcon } from "@/components/ui/Icon";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ui } from "@/lib/ui-classes";
import type { QuickBooksEstimateApiResponse } from "@/types/quickbooks";

type CreateQuickBooksEstimateButtonProps = {
  orderId: number;
  disabled?: boolean;
  onSuccess?: (result: QuickBooksEstimateApiResponse) => void;
  onError?: (message: string) => void;
};

export function CreateQuickBooksEstimateButton({
  orderId,
  disabled = false,
  onSuccess,
  onError,
}: CreateQuickBooksEstimateButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreated, setIsCreated] = useState(false);

  const handleCreate = async () => {
    if (isSubmitting || isCreated || disabled) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/quickbooks-estimate`, {
        method: "POST",
      });

      const data = (await response.json()) as QuickBooksEstimateApiResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create QuickBooks estimate");
      }

      setIsCreated(true);
      onSuccess?.(data);
    } catch (submitError) {
      onError?.(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create QuickBooks estimate"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCreated) {
    return (
      <span className={`inline-flex items-center gap-2 ${ui.badgeInStock} px-4 py-2 text-sm`}>
        <CheckCircleIcon size={16} />
        Estimate Created
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleCreate()}
      disabled={disabled || isSubmitting}
      className={`${ui.btnPrimary} bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700`}
    >
      {isSubmitting ? (
        <>
          <LoadingSpinner size="sm" variant="light" />
          Creating estimate...
        </>
      ) : (
        "Create QuickBooks Estimate"
      )}
    </button>
  );
}
