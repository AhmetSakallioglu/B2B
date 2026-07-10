"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";

export function ImpersonationBanner() {
  const pathname = usePathname();
  const { impersonation, isLoading, refreshSession } = useSession();
  const [isExiting, setIsExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (
    isLoading ||
    !impersonation ||
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return null;
  }

  const companyLabel = impersonation.companyName || "Dealer";
  const userLabel = impersonation.contactName || impersonation.customerEmail;

  const handleExit = async () => {
    setIsExiting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/stop-impersonation", {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string; redirectUrl?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to exit impersonation");
      }

      await refreshSession();
      window.location.assign(data.redirectUrl ?? "/admin/users");
    } catch (exitError) {
      setError(exitError instanceof Error ? exitError.message : "Failed to exit impersonation");
      setIsExiting(false);
    }
  };

  return (
    <div className="sticky top-0 z-[80] border-b border-orange-700/40 bg-gradient-to-r from-orange-600 to-red-600 px-4 py-3 text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium leading-relaxed">
          <span className="font-bold">IMPERSONATION MODE:</span> You are currently viewing and acting
          on behalf of Company: <strong>{companyLabel}</strong> (User: <strong>{userLabel}</strong>).
          All orders placed will be logged under your admin account.
        </p>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={isExiting}
            onClick={() => void handleExit()}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isExiting ? "Returning..." : "Exit & return to admin"}
          </button>
          {error && <span className="text-xs text-orange-100">{error}</span>}
        </div>
      </div>
    </div>
  );
}
