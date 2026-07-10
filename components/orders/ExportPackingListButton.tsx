"use client";

import { ui } from "@/lib/ui-classes";

type ExportPackingListButtonProps = {
  orderId: number;
  label?: string;
  className?: string;
};

export function ExportPackingListButton({
  orderId,
  label = "Export Packing List",
  className,
}: ExportPackingListButtonProps) {
  return (
    <a
      href={`/api/orders/${orderId}/export-packing-list`}
      className={className ?? ui.btnSecondary}
      download
    >
      {label}
    </a>
  );
}
