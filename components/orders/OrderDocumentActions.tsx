"use client";

import { useState } from "react";
import { ExportPackingListButton } from "@/components/orders/ExportPackingListButton";
import { ui } from "@/lib/ui-classes";
import type { Order, OrderCustomer } from "@/types/orders";
import type { UserProfile } from "@/types/account";

type OrderDocumentActionsProps = {
  order: Order;
};

function mapProfileToCustomer(profile: UserProfile): OrderCustomer {
  return {
    id: profile.id,
    email: profile.email,
    companyName: profile.companyName,
    contactName: profile.contactName,
    phone: profile.phone,
    federalTaxId: "",
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    city: profile.city,
    state: profile.state,
    postalCode: profile.postalCode,
    country: profile.country,
  };
}

export function OrderDocumentActions({ order }: OrderDocumentActionsProps) {
  const [isExportingInvoice, setIsExportingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadInvoice = async () => {
    setIsExportingInvoice(true);
    setError(null);

    try {
      const response = await fetch("/api/account/profile");

      if (!response.ok) {
        throw new Error("Failed to load account profile for invoice export");
      }

      const data = (await response.json()) as { profile: UserProfile };
      const { downloadOrderPdf } = await import("@/lib/order-pdf");

      downloadOrderPdf({
        ...order,
        customer: mapProfileToCustomer(data.profile),
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "Failed to generate invoice PDF"
      );
    } finally {
      setIsExportingInvoice(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void handleDownloadInvoice()}
          disabled={isExportingInvoice}
          className={`${ui.btnSecondary} disabled:opacity-60`}
        >
          {isExportingInvoice ? "Generating..." : "Download Invoice"}
        </button>
        <ExportPackingListButton
          orderId={order.id}
          label="Download Packing List (PDF)"
          className={`${ui.btnSecondary} border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-950/50`}
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
