"use client";

import { AdminButton } from "@/components/admin/admin-ui";
import { EyeIcon, EyeOffIcon, PackageIcon } from "@/components/ui/Icon";

const STOCK_OUT_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200/90 bg-orange-50 px-3.5 py-2 text-xs font-semibold text-orange-800 shadow-sm transition duration-200 hover:scale-[1.01] hover:bg-orange-100 active:scale-[0.99] dark:border-orange-900/50 dark:bg-orange-950/35 dark:text-orange-200 dark:hover:bg-orange-950/55 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

const STOCK_IN_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition duration-200 hover:scale-[1.01] hover:bg-emerald-100 active:scale-[0.99] dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-200 dark:hover:bg-emerald-950/55 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

type CatalogBulkActionButtonsProps = {
  productId: number;
  productName: string;
  isListed: boolean;
  allVariantsOutOfStock: boolean;
  disabled?: boolean;
  isBusy?: boolean;
  onToggleStock: (
    productId: number,
    productName: string,
    allVariantsOutOfStock: boolean
  ) => void;
  onToggleUnlist: (productId: number, productName: string, isListed: boolean) => void;
};

export function CatalogBulkActionButtons({
  productId,
  productName,
  isListed,
  allVariantsOutOfStock,
  disabled = false,
  isBusy = false,
  onToggleStock,
  onToggleUnlist,
}: CatalogBulkActionButtonsProps) {
  return (
    <>
      <button
        type="button"
        disabled={disabled || isBusy}
        onClick={() => onToggleStock(productId, productName, allVariantsOutOfStock)}
        title={
          allVariantsOutOfStock
            ? "Mark all finishes and variants in stock"
            : "Mark all finishes and variants out of stock"
        }
        className={allVariantsOutOfStock ? STOCK_IN_CLASSES : STOCK_OUT_CLASSES}
      >
        <PackageIcon size={14} />
        <span className="hidden xl:inline">
          {allVariantsOutOfStock ? "Mark all in stock" : "Mark all out of stock"}
        </span>
      </button>
      <AdminButton
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled || isBusy}
        onClick={() => onToggleUnlist(productId, productName, isListed)}
        title={isListed ? "Unlist product from catalog" : "List product in catalog"}
      >
        <span className="inline-flex items-center gap-1.5">
          {isListed ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
          <span className="hidden xl:inline">{isListed ? "Unlist product" : "List product"}</span>
        </span>
      </AdminButton>
    </>
  );
}
