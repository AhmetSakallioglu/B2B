"use client";

import { useId, useState } from "react";
import { AdminButton, AdminLink } from "@/components/admin/admin-ui";
import { CatalogBulkActionButtons } from "@/components/admin/CatalogBulkActionButtons";
import { ChevronDownIcon } from "@/components/ui/Icon";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { AdminProductGroup } from "@/lib/admin-product-groups";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { AdminProductRow } from "@/types/admin";

type AdminProductGroupCardProps = {
  group: AdminProductGroup;
  filterSignature?: string;
  onDeleteVariant?: (variant: AdminProductRow) => void;
  onDeleteGroup?: (group: AdminProductGroup) => void;
  onToggleStock?: (
    productId: number,
    productName: string,
    allVariantsOutOfStock: boolean
  ) => void;
  onToggleUnlist?: (productId: number, productName: string, isListed: boolean) => void;
  deletingVariantId?: number | null;
  bulkActionProductId?: number | null;
};

function StockLabel({ status }: { status: AdminProductRow["stock_status"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none ${
        status === "in_stock"
          ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
          : "bg-red-500/10 text-red-700 dark:text-red-300"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function AdminGroupVariantRow({
  variant,
  onDeleteVariant,
  deletingVariantId,
}: {
  variant: AdminProductRow;
  onDeleteVariant?: (variant: AdminProductRow) => void;
  deletingVariantId?: number | null;
}) {
  const editHref = `/admin/products/${variant.variant_id}/edit`;

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200/60 bg-slate-50/80 p-2.5 dark:border-zinc-700/50 dark:bg-navy-hover/70">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium leading-snug text-navy dark:text-cream"
            title={variant.finish_name}
          >
            {variant.finish_name}
          </p>
          <p
            className="mt-0.5 break-all font-mono text-[11px] leading-snug text-muted dark:text-cream/55"
            title={variant.variant_sku}
          >
            {variant.variant_sku}
          </p>
        </div>
        <StockLabel status={variant.stock_status} />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-border/60 pt-2 dark:border-border/60">
        <p className="mr-auto text-sm font-semibold tabular-nums text-brand">
          {formatPrice(Number.parseFloat(variant.price))}
        </p>
        <AdminLink href={editHref}>Edit</AdminLink>
        {onDeleteVariant && (
          <AdminButton
            type="button"
            variant="danger"
            size="sm"
            disabled={deletingVariantId === variant.variant_id}
            onClick={() => onDeleteVariant(variant)}
          >
            Delete
          </AdminButton>
        )}
      </div>
    </div>
  );
}

export function AdminProductGroupCard({
  group,
  filterSignature = "",
  onDeleteVariant,
  onDeleteGroup,
  onToggleStock,
  onToggleUnlist,
  deletingVariantId = null,
  bulkActionProductId = null,
}: AdminProductGroupCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const variantColumns = group.variants.length > 1 ? "md:grid-cols-2" : "grid-cols-1";

  useDeferredEffect(() => {
    setIsOpen(false);
  }, [filterSignature]);

  return (
    <article className={`min-w-0 overflow-hidden ${ui.adminCard}`}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-2 sm:px-3">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-slate-50 dark:hover:bg-navy-hover/70">
            <ChevronDownIcon
              size={16}
              className={`text-muted transition-transform duration-200 dark:text-cream/60 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </span>

          <span className="min-w-0 overflow-hidden">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-brand">
                {group.productSku}
              </span>
              <span
                className="min-w-0 truncate text-sm font-medium text-navy dark:text-cream"
                title={group.productName}
              >
                {group.productName}
              </span>
            </span>

            <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0 text-[11px] leading-snug text-muted dark:text-cream/65">
              <span className="whitespace-nowrap font-medium text-navy/80 dark:text-cream/80">
                {group.widthIn}&quot; × {group.heightIn}&quot; × {group.depthIn}&quot;
              </span>
              <span className="hidden text-muted/70 sm:inline dark:text-cream/45">·</span>
              <span
                className="min-w-0 truncate"
                title={`${group.category} · ${group.subCategory}`}
              >
                {group.category} · {group.subCategory}
              </span>
              <span className="hidden text-muted/70 sm:inline dark:text-cream/45">·</span>
              <span className="whitespace-nowrap">
                {group.variants.length} finish{group.variants.length === 1 ? "" : "es"}
              </span>
              {!group.isListed && (
                <>
                  <span className="hidden text-muted/70 sm:inline dark:text-cream/45">·</span>
                  <span className="whitespace-nowrap font-semibold uppercase text-amber-700 dark:text-amber-300">
                    Unlisted
                  </span>
                </>
              )}
              {group.allVariantsOutOfStock && (
                <>
                  <span className="hidden text-muted/70 sm:inline dark:text-cream/45">·</span>
                  <span className="whitespace-nowrap font-semibold uppercase text-red-700 dark:text-red-300">
                    All out of stock
                  </span>
                </>
              )}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {onToggleStock && onToggleUnlist && (
            <CatalogBulkActionButtons
              productId={group.productId}
              productName={group.productName}
              isListed={group.isListed}
              allVariantsOutOfStock={group.allVariantsOutOfStock}
              disabled={deletingVariantId !== null}
              isBusy={bulkActionProductId === group.productId}
              onToggleStock={onToggleStock}
              onToggleUnlist={onToggleUnlist}
            />
          )}
          {onDeleteGroup && (
            <AdminButton
              type="button"
              variant="danger"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              disabled={deletingVariantId !== null || bulkActionProductId === group.productId}
              onClick={() => onDeleteGroup(group)}
            >
              Delete
            </AdminButton>
          )}
        </div>
      </div>

      {isOpen && (
        <div
          id={panelId}
          className="border-t border-slate-200/80 px-2 pb-2 pt-2 dark:border-zinc-700/50 sm:px-3"
        >
          <div className={`grid grid-cols-1 gap-2 ${variantColumns}`}>
            {group.variants.map((variant) => (
              <AdminGroupVariantRow
                key={variant.variant_id}
                variant={variant}
                onDeleteVariant={onDeleteVariant}
                deletingVariantId={deletingVariantId}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
