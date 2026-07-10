import { AdminButton, AdminLink } from "@/components/admin/admin-ui";
import { CatalogBulkActionButtons } from "@/components/admin/CatalogBulkActionButtons";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { AdminProductRow } from "@/types/admin";

type AdminProductVariantCardProps = {
  product: AdminProductRow;
  allVariantsOutOfStock: boolean;
  onDelete?: (product: AdminProductRow) => void;
  onToggleStock?: (
    productId: number,
    productName: string,
    allVariantsOutOfStock: boolean
  ) => void;
  onToggleUnlist?: (productId: number, productName: string, isListed: boolean) => void;
  isDeleting?: boolean;
  isBulkBusy?: boolean;
};

export function AdminProductVariantCard({
  product,
  allVariantsOutOfStock,
  onDelete,
  onToggleStock,
  onToggleUnlist,
  isDeleting = false,
  isBulkBusy = false,
}: AdminProductVariantCardProps) {
  const editHref = `/admin/products/${product.variant_id}/edit`;

  return (
    <article className={`min-w-0 overflow-hidden ${ui.adminCard}`}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5">
        <div className="min-w-0 overflow-hidden">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-brand">
              {product.product_sku}
            </span>
            <span
              className="min-w-0 truncate text-sm font-medium text-navy dark:text-cream"
              title={product.finish_name}
            >
              {product.finish_name}
            </span>
            <span
              className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none ${
                product.stock_status === "in_stock"
                  ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
                  : "bg-red-500/10 text-red-700 dark:text-red-300"
              }`}
            >
              {product.stock_status.replace("_", " ")}
            </span>
            {!product.is_listed && (
              <span className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none bg-amber-500/12 text-amber-800 dark:text-amber-300">
                Unlisted
              </span>
            )}
          </div>

          <p
            className="mt-0.5 truncate text-[11px] leading-snug text-muted dark:text-cream/60"
            title={`${product.product_name} · ${product.category} · ${product.sub_category}`}
          >
            {product.product_name} · {product.category} · {product.sub_category}
          </p>
          <p
            className="mt-0.5 break-all font-mono text-[11px] leading-snug text-muted dark:text-cream/55"
            title={product.variant_sku}
          >
            {product.variant_sku} · {product.width_in}&quot; × {product.height_in}&quot; ×{" "}
            {product.depth_in}&quot;
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold tabular-nums text-brand">
            {formatPrice(Number.parseFloat(product.price))}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onToggleStock && onToggleUnlist && (
              <CatalogBulkActionButtons
                productId={product.product_id}
                productName={product.product_name}
                isListed={product.is_listed}
                allVariantsOutOfStock={allVariantsOutOfStock}
                disabled={isDeleting}
                isBusy={isBulkBusy}
                onToggleStock={onToggleStock}
                onToggleUnlist={onToggleUnlist}
              />
            )}
            <AdminLink href={editHref}>Edit</AdminLink>
            {onDelete && (
              <AdminButton
                type="button"
                variant="danger"
                size="sm"
                disabled={isDeleting || isBulkBusy}
                onClick={() => onDelete(product)}
              >
                Delete
              </AdminButton>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
