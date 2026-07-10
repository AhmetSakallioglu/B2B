"use client";

import { useState } from "react";
import { AdminButton } from "@/components/admin/admin-ui";
import { KeyIcon } from "@/components/ui/Icon";

type ImpersonateCustomerButtonProps = {
  userId: number;
  disabled?: boolean;
  compact?: boolean;
};

export function ImpersonateCustomerButton({
  userId,
  disabled = false,
  compact = false,
}: ImpersonateCustomerButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/impersonate`, {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string; redirectUrl?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to start impersonation");
      }

      window.location.assign(data.redirectUrl ?? "/catalog");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start impersonation");
      setIsStarting(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <AdminButton
        type="button"
        variant="secondary"
        disabled={disabled || isStarting}
        onClick={() => void handleClick()}
      >
        <span className="inline-flex items-center gap-2">
          <KeyIcon size={15} />
          {compact ? "Impersonate" : "Impersonate (log in as customer)"}
        </span>
      </AdminButton>
      {error && <span className="text-xs text-red-600 dark:text-red-300">{error}</span>}
    </div>
  );
}
