"use client";

import Link from "next/link";
import { FormEvent, useCallback, useMemo, useState } from "react";
import {
  AdminAlert,
  AdminButton,
  AdminFieldLabel,
  AdminLink,
  AdminFormSection,
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/admin-ui";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { FinishMultiSelect } from "@/components/admin/FinishMultiSelect";
import { ProductImageManager, type PendingImage } from "@/components/admin/ProductImageManager";
import { buildVariantSku } from "@/lib/product-admin";
import { ui } from "@/lib/ui-classes";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { CatalogCategory } from "@/types/admin";
import type { AdminDoorFinish } from "@/types/door-finish";

const STOCK_OPTIONS = [
  { value: "in_stock", label: "In Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
];

const INITIAL_FORM = {
  categorySlug: "",
  subCategorySlug: "",
  productSku: "",
  productName: "",
  description: "",
  widthIn: "",
  heightIn: "",
  depthIn: "",
  stockStatus: "in_stock",
  price: "",
  variantSku: "",
};

export default function AdminProductsPage() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [finishes, setFinishes] = useState<AdminDoorFinish[]>([]);
  const [finishIds, setFinishIds] = useState<number[]>([]);
  const [multiFinishMode, setMultiFinishMode] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProductImages, setPendingProductImages] = useState<PendingImage[]>([]);
  const [pricesByFinish, setPricesByFinish] = useState<Record<number, string>>({});

  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === form.categorySlug),
    [categories, form.categorySlug]
  );

  const selectedFinishes = useMemo(
    () => finishes.filter((finish) => finishIds.includes(finish.id)),
    [finishes, finishIds]
  );

  const suggestedVariantSkus = useMemo(() => {
    const width = Number.parseFloat(form.widthIn);
    const height = Number.parseFloat(form.heightIn);
    const depth = Number.parseFloat(form.depthIn);

    if (!form.productSku || selectedFinishes.length === 0 || [width, height, depth].some(Number.isNaN)) {
      return [];
    }

    return selectedFinishes.map((finish) =>
      buildVariantSku(form.productSku.toUpperCase(), finish.name, width, height, depth)
    );
  }, [form.productSku, selectedFinishes, form.widthIn, form.heightIn, form.depthIn]);

  const handleFinishChange = (ids: number[]) => {
    if (!multiFinishMode && ids.length === 1) {
      setForm((current) => ({ ...current, variantSku: "" }));
    }

    setFinishIds(ids);
  };

  const handleMultiFinishModeChange = (enabled: boolean) => {
    setMultiFinishMode(enabled);

    if (enabled && form.price) {
      setPricesByFinish((current) => {
        const next = { ...current };

        for (const id of finishIds) {
          if (!next[id]) {
            next[id] = form.price;
          }
        }

        return next;
      });
    }

    if (!enabled && finishIds.length > 1) {
      setFinishIds([finishIds[0]]);
      setForm((current) => ({ ...current, variantSku: "" }));
    }
  };

  const updatePriceForFinish = (finishId: number, value: string) => {
    setPricesByFinish((current) => ({
      ...current,
      [finishId]: value,
    }));
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [catalogResponse, finishesResponse] = await Promise.all([
        fetch("/api/admin/catalog"),
        fetch("/api/admin/finishes"),
      ]);

      if (!catalogResponse.ok || !finishesResponse.ok) {
        throw new Error("Failed to load product admin data");
      }

      const catalogData = (await catalogResponse.json()) as {
        categories: CatalogCategory[];
      };
      const finishesData = (await finishesResponse.json()) as {
        finishes: AdminDoorFinish[];
      };

      setCategories(catalogData.categories);
      setFinishes(finishesData.finishes);

      if (catalogData.categories.length > 0) {
        setForm((current) => ({
          ...current,
          categorySlug: current.categorySlug || catalogData.categories[0].slug,
          subCategorySlug:
            current.subCategorySlug ||
            catalogData.categories[0].subCategories[0]?.slug ||
            "",
        }));
      }

      if (finishesData.finishes.length > 0) {
        setFinishIds((current) =>
          current.length > 0 ? current : [finishesData.finishes[0].id]
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load data"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const handlePendingProductImagesChange = useCallback((images: PendingImage[]) => {
    setPendingProductImages(images);
  }, []);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "categorySlug") {
        const category = categories.find((item) => item.slug === value);
        next.subCategorySlug = category?.subCategories[0]?.slug ?? "";
      }

      return next;
    });
  };

  const uploadImage = async (file: File) => {
    const uploadData = new FormData();
    uploadData.append("file", file);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: uploadData,
    });

    const data = (await response.json()) as { url?: string; error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to upload image");
    }

    return data.url ?? "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      if (multiFinishMode) {
        for (const finish of selectedFinishes) {
          const price = Number.parseFloat(pricesByFinish[finish.id] ?? "");

          if (Number.isNaN(price) || price < 0) {
            throw new Error(`Enter a valid price for ${finish.name}`);
          }
        }
      }

      const productImages: string[] = [];

      for (const item of pendingProductImages) {
        productImages.push(await uploadImage(item.file));
      }

      const payload = {
        categorySlug: form.categorySlug,
        subCategorySlug: form.subCategorySlug,
        productSku: form.productSku.trim().toUpperCase(),
        productName: form.productName.trim(),
        description: form.description.trim(),
        productImages,
        widthIn: Number.parseFloat(form.widthIn),
        heightIn: Number.parseFloat(form.heightIn),
        depthIn: Number.parseFloat(form.depthIn),
        finishIds,
        finishName: selectedFinishes[0]?.name ?? "",
        stockStatus: form.stockStatus,
        ...(multiFinishMode
          ? {
              finishPrices: selectedFinishes.map((finish) => ({
                finishId: finish.id,
                price: Number.parseFloat(pricesByFinish[finish.id] ?? ""),
              })),
            }
          : { price: Number.parseFloat(form.price) }),
        variantSku:
          finishIds.length === 1
            ? form.variantSku.trim() || suggestedVariantSkus[0] || ""
            : "",
      };

      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        product?: { name: string };
        createdCount?: number;
        skippedCount?: number;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create product");
      }

      const skippedNote =
        data.skippedCount && data.skippedCount > 0
          ? ` ${data.skippedCount} finish variant(s) already existed and were skipped.`
          : "";

      setMessage(
        `Product "${data.product?.name}" added with ${data.createdCount ?? 1} finish variant(s).${skippedNote}`
      );
      pendingProductImages.forEach((image) => URL.revokeObjectURL(image.preview));
      setPendingProductImages([]);
      setPricesByFinish({});
      setForm((current) => ({
        ...INITIAL_FORM,
        categorySlug: current.categorySlug,
        subCategorySlug: current.subCategorySlug,
        stockStatus: "in_stock",
      }));
      setFinishIds(finishes.length > 0 ? [finishes[0].id] : []);
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create product"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminShell
      wide
      title="Add Product"
      subtitle="Create a new cabinet module and one variant per selected door finish"
    >
      <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 ${ui.adminCard} px-5 py-4`}>
        <Link href="/admin/products/catalog" className={`text-sm font-medium text-brand hover:text-brand-hover`}>
          ← Back to catalog
        </Link>
        <AdminLink href="/admin/products/catalog">View catalog</AdminLink>
      </div>

      {isLoading ? (
        <LoadingState label="Loading form..." minHeight="min-h-[320px]" spinnerSize="lg" />
      ) : categories.length === 0 ? (
        <AdminPanel className="sm:p-8">
          <h2 className={ui.heading3}>No categories configured</h2>
          <p className={`mt-2 ${ui.bodyMuted}`}>
            Add at least one category and subcategory before creating products.
          </p>
          <Link href="/admin/categories" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
            Manage categories
          </Link>
        </AdminPanel>
      ) : (
        <AdminPanel className="sm:p-8">
          <h2 className={ui.heading3}>Add cabinet product</h2>
          <p className={`mt-2 ${ui.bodyMuted}`}>
            Creates a product module and one variant per selected door finish.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            <AdminFormSection
              title="Classification"
              description="Choose where this cabinet appears in the catalog."
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block space-y-1.5">
                  <AdminFieldLabel>Category</AdminFieldLabel>
                  <AdminSelect
                    required
                    value={form.categorySlug}
                    onChange={(event) => updateField("categorySlug", event.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </AdminSelect>
                </label>

                <label className="block space-y-1.5">
                  <AdminFieldLabel>Sub category</AdminFieldLabel>
                  <AdminSelect
                    required
                    value={form.subCategorySlug}
                    onChange={(event) => updateField("subCategorySlug", event.target.value)}
                  >
                    {selectedCategory?.subCategories.map((subCategory) => (
                      <option key={subCategory.slug} value={subCategory.slug}>
                        {subCategory.name}
                      </option>
                    ))}
                  </AdminSelect>
                </label>

                <label className="block space-y-1.5">
                  <AdminFieldLabel>Stock status</AdminFieldLabel>
                  <AdminSelect
                    value={form.stockStatus}
                    onChange={(event) => updateField("stockStatus", event.target.value)}
                  >
                    {STOCK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </AdminSelect>
                </label>
              </div>
            </AdminFormSection>

            <div className="grid gap-8 xl:grid-cols-2">
              <AdminFormSection
                title="Product details"
                description="Core cabinet information shared across all finish variants."
              >
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <AdminFieldLabel>Product SKU</AdminFieldLabel>
                      <AdminInput
                        required
                        value={form.productSku}
                        onChange={(event) => updateField("productSku", event.target.value)}
                        placeholder="B24"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <AdminFieldLabel>Product name</AdminFieldLabel>
                      <AdminInput
                        required
                        value={form.productName}
                        onChange={(event) => updateField("productName", event.target.value)}
                        placeholder="Base Cabinet B24"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1.5">
                    <AdminFieldLabel>Description</AdminFieldLabel>
                    <AdminTextarea
                      required
                      rows={4}
                      value={form.description}
                      onChange={(event) => updateField("description", event.target.value)}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {(["widthIn", "heightIn", "depthIn"] as const).map((field) => (
                      <label key={field} className="block space-y-1.5">
                        <AdminFieldLabel>
                          {field === "widthIn"
                            ? "Width (in)"
                            : field === "heightIn"
                              ? "Height (in)"
                              : "Depth (in)"}
                        </AdminFieldLabel>
                        <AdminInput
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form[field]}
                          onChange={(event) => updateField(field, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </AdminFormSection>

              <AdminFormSection
                title="Finishes & pricing"
                description="Select door finishes and set pricing for the new variants."
              >
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <AdminFieldLabel>Door / finish</AdminFieldLabel>
                    <FinishMultiSelect
                      finishes={finishes}
                      selectedIds={finishIds}
                      onChange={handleFinishChange}
                      disabled={isSubmitting}
                      mode={multiFinishMode ? "multiple" : "single"}
                    />
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-cream/90">
                      <input
                        type="checkbox"
                        checked={multiFinishMode}
                        onChange={(event) => handleMultiFinishModeChange(event.target.checked)}
                        disabled={isSubmitting}
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand-ring"
                      />
                      Create variants for multiple finishes at once
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {!multiFinishMode && (
                      <label className="block space-y-1.5">
                        <AdminFieldLabel>Price (USD)</AdminFieldLabel>
                        <AdminInput
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.price}
                          onChange={(event) => updateField("price", event.target.value)}
                        />
                      </label>
                    )}
                    {!multiFinishMode && (
                      <label className="block space-y-1.5">
                        <AdminFieldLabel>Variant SKU</AdminFieldLabel>
                        <AdminInput
                          value={form.variantSku}
                          onChange={(event) => updateField("variantSku", event.target.value)}
                          placeholder={suggestedVariantSkus[0] || "Auto-generated if empty"}
                        />
                      </label>
                    )}
                  </div>

                  {multiFinishMode && (
                    <div className="space-y-3">
                      <p className={ui.fieldLabel}>Price by finish</p>
                      {selectedFinishes.length === 0 ? (
                        <p className={ui.bodyMuted}>
                          Select at least one finish to set pricing.
                        </p>
                      ) : (
                        selectedFinishes.map((finish) => (
                          <label
                            key={finish.id}
                            className="block space-y-1.5 rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 dark:border-zinc-700/50 dark:bg-navy/60"
                          >
                            <AdminFieldLabel>{finish.name} — Price (USD)</AdminFieldLabel>
                            <AdminInput
                              required
                              type="number"
                              min="0"
                              step="0.01"
                              value={pricesByFinish[finish.id] ?? ""}
                              onChange={(event) =>
                                updatePriceForFinish(finish.id, event.target.value)
                              }
                            />
                          </label>
                        ))
                      )}
                    </div>
                  )}

                  {multiFinishMode && (
                    <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 dark:border-zinc-700/50 dark:bg-navy/60">
                      <p className={ui.fieldLabel}>Auto-generated variant SKUs</p>
                      {suggestedVariantSkus.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-slate-800 dark:text-cream/90">
                          {selectedFinishes.map((finish, index) => (
                            <li key={finish.id}>
                              {finish.name}: {suggestedVariantSkus[index]}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={`mt-2 ${ui.bodyMuted}`}>
                          Enter product SKU and dimensions to preview variant SKUs for each
                          selected finish.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </AdminFormSection>
            </div>

            <AdminFormSection
              title="Product images (optional)"
              description="Technical drawings shared across all finish variants. Finish lifestyle photos are managed on Door Finishes."
            >
              <ProductImageManager
                finishId={finishIds[0] ?? 0}
                finishName="Product"
                hideFinishHeading
                disabled={isSubmitting}
                onPendingChange={handlePendingProductImagesChange}
              />
            </AdminFormSection>

            {message && <AdminAlert tone="success">{message}</AdminAlert>}
            {error && <AdminAlert tone="error">{error}</AdminAlert>}

            <AdminButton
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Adding product..." : "Add product to catalog"}
            </AdminButton>
          </form>
        </AdminPanel>
      )}
    </AdminShell>
  );
}
