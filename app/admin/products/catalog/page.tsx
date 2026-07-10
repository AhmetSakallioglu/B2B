"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { BulkProductUpload } from "@/components/admin/BulkProductUpload";
import { AdminProductGroupCard } from "@/components/admin/AdminProductGroupCard";
import { AdminProductVariantCard } from "@/components/admin/AdminProductVariantCard";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import {
  filterAdminProducts,
  getAdminProductCategories,
  getAdminProductSubCategories,
} from "@/lib/admin-product-search";
import {
  getAdminProductFinishes,
  getProductAllVariantsOutOfStock,
  groupAdminProducts,
  type AdminProductGroup,
} from "@/lib/admin-product-groups";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";
import type { AdminProductRow } from "@/types/admin";

type PendingDelete =
  | { type: "variant"; variant: AdminProductRow }
  | { type: "group"; group: AdminProductGroup };

const STOCK_TOAST_MESSAGE = "Stock status updated successfully.";

const STOCK_OPTIONS = [
  { value: "all", label: "All stock" },
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

const VIEW_OPTIONS = [
  { value: "grouped", label: "Grouped by cabinet" },
  { value: "variants", label: "All variants" },
] as const;

type CatalogViewMode = (typeof VIEW_OPTIONS)[number]["value"];

const CATALOG_TABS = [
  { value: "catalog", label: "Catalog" },
  { value: "bulk", label: "Bulk Import (Excel/CSV)" },
] as const;

type CatalogTab = (typeof CATALOG_TABS)[number]["value"];

export default function AdminProductCatalogPage() {
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [finishFilter, setFinishFilter] = useState("all");
  const [viewMode, setViewMode] = useState<CatalogViewMode>("grouped");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkActionProductId, setBulkActionProductId] = useState<number | null>(null);
  const [deletingVariantId, setDeletingVariantId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant?: "success" | "error" } | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<CatalogTab>("catalog");

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/admin/products");

      if (!response.ok) {
        throw new Error("Failed to load catalog products");
      }

      const data = (await response.json()) as { products: AdminProductRow[] };
      setProducts(data.products);
    } catch (loadError) {
      setLoadError(
        loadError instanceof Error ? loadError.message : "Failed to load products"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const categories = useMemo(
    () => getAdminProductCategories(products),
    [products]
  );

  const subCategories = useMemo(
    () => getAdminProductSubCategories(products, categoryFilter),
    [products, categoryFilter]
  );

  const finishes = useMemo(() => getAdminProductFinishes(products), [products]);

  useDeferredEffect(() => {
    if (subCategoryFilter === "all") {
      return;
    }

    if (!subCategories.includes(subCategoryFilter)) {
      setSubCategoryFilter("all");
    }
  }, [subCategories, subCategoryFilter]);

  const filteredProducts = useMemo(
    () =>
      filterAdminProducts(
        products,
        searchQuery,
        categoryFilter,
        subCategoryFilter,
        stockFilter,
        finishFilter
      ),
    [products, searchQuery, categoryFilter, subCategoryFilter, stockFilter, finishFilter]
  );

  const groupedProducts = useMemo(
    () => groupAdminProducts(filteredProducts),
    [filteredProducts]
  );

  const productStockState = useMemo(() => {
    const state = new Map<number, boolean>();

    for (const product of products) {
      if (!state.has(product.product_id)) {
        state.set(
          product.product_id,
          getProductAllVariantsOutOfStock(products, product.product_id)
        );
      }
    }

    return state;
  }, [products]);

  const filterSignature = [
    searchQuery,
    categoryFilter,
    subCategoryFilter,
    stockFilter,
    finishFilter,
    viewMode,
  ].join("|");

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    categoryFilter !== "all" ||
    subCategoryFilter !== "all" ||
    stockFilter !== "all" ||
    finishFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSubCategoryFilter("all");
    setStockFilter("all");
    setFinishFilter("all");
  };

  const getDeleteDialogCopy = (pending: PendingDelete) => {
    if (pending.type === "variant") {
      return {
        title: "Soft-delete this finish variant?",
        description: `${pending.variant.finish_name} for ${pending.variant.product_sku} (${pending.variant.variant_sku}) will be hidden from the catalog but can be restored from Audit Log.`,
        confirmLabel: "Soft delete",
        tone: "warning" as const,
      };
    }

    return {
      title: "Soft-delete this entire cabinet?",
      description: `All ${pending.group.variants.length} finish variant(s) for ${pending.group.productSku} at ${pending.group.widthIn}" × ${pending.group.heightIn}" × ${pending.group.depthIn}" will be hidden from the catalog but can be restored from Audit Log.`,
      confirmLabel: "Soft delete",
      tone: "warning" as const,
    };
  };

  const runBulkStatus = async (
    productId: number,
    action: "out_of_stock" | "in_stock" | "toggle_unlist"
  ) => {
    setBulkActionProductId(productId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/catalog/${productId}/bulk-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update product status");
      }

      const toastMessage =
        action === "out_of_stock" || action === "in_stock"
          ? STOCK_TOAST_MESSAGE
          : (data.message ?? "Product status updated.");

      setToast({ message: toastMessage, variant: "success" });
      await loadProducts();
    } catch (bulkError) {
      const errorMessage =
        bulkError instanceof Error ? bulkError.message : "Failed to update product status";
      setError(errorMessage);
      setToast({ message: errorMessage, variant: "error" });
    } finally {
      setBulkActionProductId(null);
    }
  };

  const handleToggleStock = async (
    productId: number,
    _productName: string,
    allVariantsOutOfStock: boolean
  ) => {
    await runBulkStatus(productId, allVariantsOutOfStock ? "in_stock" : "out_of_stock");
  };

  const handleToggleUnlist = async (
    productId: number,
    _productName: string,
    _isListed: boolean
  ) => {
    await runBulkStatus(productId, "toggle_unlist");
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    const variantId =
      pendingDelete.type === "variant"
        ? pendingDelete.variant.variant_id
        : pendingDelete.group.variants[0]?.variant_id;

    if (!variantId) {
      return;
    }

    setIsDeleting(true);
    setDeletingVariantId(variantId);
    setError(null);
    setMessage(null);

    try {
      const scope = pendingDelete.type === "group" ? "?scope=group" : "";
      const response = await fetch(`/api/admin/products/${variantId}${scope}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete product");
      }

      setMessage(
        pendingDelete.type === "group"
          ? "Cabinet and all finish variants deleted."
          : "Finish variant deleted."
      );
      setPendingDelete(null);
      await loadProducts();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete product");
    } finally {
      setIsDeleting(false);
      setDeletingVariantId(null);
    }
  };

  const deleteDialog = pendingDelete ? getDeleteDialogCopy(pendingDelete) : null;

  return (
    <AdminShell
      wide
      title="Product Catalog"
      subtitle="Group cabinets by SKU and size, then edit each door finish separately"
    >
      <div className="flex min-h-[calc(100vh-14rem)] min-w-0 flex-col gap-6">
        <div className={`${ui.tabBar} w-fit`}>
          {CATALOG_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={activeTab === tab.value ? ui.tabActive : ui.tabIdle}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "bulk" ? (
          <BulkProductUpload onComplete={loadProducts} />
        ) : (
          <>
        {message && (
          <p className="rounded-xl border border-brand/20 bg-brand-light px-4 py-3 text-sm text-navy dark:text-cream">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={ui.bodyMuted}>
            {viewMode === "grouped"
              ? `${groupedProducts.length} cabinet group(s) · ${filteredProducts.length} variant(s)`
              : `${filteredProducts.length} of ${products.length} variants shown`}
          </p>
          <Link href="/admin/products" className={ui.btnPrimary}>
            Add new product
          </Link>
        </div>

        <section className={`p-5 sm:p-6 ${ui.adminCard}`}>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <label className="block space-y-1.5 xl:col-span-2">
              <span className={ui.fieldLabel}>Search catalog</span>
              <div className="relative">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="B21, White Shaker, base cabinet..."
                  className={`${ui.input} pl-10`}
                />
                <svg
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                  />
                </svg>
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className={ui.fieldLabel}>Door finish</span>
              <select
                value={finishFilter}
                onChange={(event) => setFinishFilter(event.target.value)}
                className={`${ui.select} w-full`}
              >
                <option value="all">All finishes</option>
                {finishes.map((finish) => (
                  <option key={finish} value={finish}>
                    {finish}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={ui.fieldLabel}>View</span>
              <select
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as CatalogViewMode)}
                className={`${ui.select} w-full`}
              >
                {VIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={ui.fieldLabel}>Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className={`${ui.select} w-full`}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={ui.fieldLabel}>Sub category</span>
              <select
                value={subCategoryFilter}
                onChange={(event) => setSubCategoryFilter(event.target.value)}
                className={`${ui.select} w-full`}
              >
                <option value="all">All sub categories</option>
                {subCategories.map((subCategory) => (
                  <option key={subCategory} value={subCategory}>
                    {subCategory}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={ui.fieldLabel}>Stock</span>
              <select
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
                className={`${ui.select} w-full`}
              >
                {STOCK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-cream/75 dark:hover:text-cream"
            >
              Clear filters
            </button>
          )}
        </section>

        {isLoading ? (
          <LoadingState label="Loading catalog..." minHeight="min-h-[320px]" spinnerSize="lg" />
        ) : loadError ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {loadError}
          </p>
        ) : filteredProducts.length === 0 ? (
          <div className={`flex flex-1 flex-col items-center justify-center px-6 py-16 text-center ${ui.emptyState}`}>
            <p className="text-lg font-semibold text-slate-900 dark:text-cream">
              No variants match your search
            </p>
            <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-cream/70">
              Try searching by product SKU (e.g. B21), finish name, or clear the filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className={`mt-5 ${ui.btnSecondary}`}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : viewMode === "grouped" ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {groupedProducts.map((group) => (
              <AdminProductGroupCard
                key={group.key}
                group={group}
                filterSignature={filterSignature}
                deletingVariantId={deletingVariantId}
                bulkActionProductId={bulkActionProductId}
                onToggleStock={handleToggleStock}
                onToggleUnlist={handleToggleUnlist}
                onDeleteVariant={(variant) => setPendingDelete({ type: "variant", variant })}
                onDeleteGroup={(groupToDelete) => setPendingDelete({ type: "group", group: groupToDelete })}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {filteredProducts.map((product) => (
              <AdminProductVariantCard
                key={product.variant_id}
                product={product}
                allVariantsOutOfStock={productStockState.get(product.product_id) ?? false}
                isDeleting={deletingVariantId === product.variant_id}
                isBulkBusy={bulkActionProductId === product.product_id}
                onToggleStock={handleToggleStock}
                onToggleUnlist={handleToggleUnlist}
                onDelete={(variant) => setPendingDelete({ type: "variant", variant })}
              />
            ))}
          </div>
        )}
          </>
        )}
      </div>

      {deleteDialog && activeTab === "catalog" && (
        <ConfirmDialog
          open
          tone={deleteDialog.tone}
          title={deleteDialog.title}
          description={deleteDialog.description}
          confirmLabel={deleteDialog.confirmLabel}
          cancelLabel="Keep item"
          loading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (!isDeleting) {
              setPendingDelete(null);
            }
          }}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant ?? "success"}
          onClose={() => setToast(null)}
        />
      )}
    </AdminShell>
  );
}
