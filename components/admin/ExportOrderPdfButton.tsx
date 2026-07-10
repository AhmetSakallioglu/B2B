"use client";

import { useState } from "react";
import { ui } from "@/lib/ui-classes";
import type { OrderWithCustomer } from "@/types/orders";

type ExportOrderPdfButtonProps = {
  order: OrderWithCustomer;
};

export function ExportOrderPdfButton({ order }: ExportOrderPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const { downloadOrderPdf } = await import("@/lib/order-pdf");
      downloadOrderPdf(order);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Failed to generate PDF"
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={isExporting}
        className={`${ui.btnSecondary} disabled:opacity-60`}
      >
        {isExporting ? "Generating PDF..." : "Export PDF"}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
