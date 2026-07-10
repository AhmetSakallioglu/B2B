"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  AdminAlert,
  AdminButton,
  AdminFieldLabel,
  AdminFormSection,
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/admin-ui";
import { AdminFinishBadge } from "@/components/admin/AdminFinishBadge";
import { ProductGalleryEditor } from "@/components/admin/ProductGalleryEditor";
import { SiblingVariantsBar } from "@/components/admin/SiblingVariantsBar";
import { buildVariantSku } from "@/lib/product-admin";
import { ui } from "@/lib/ui-classes";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { AdminProductDetail, AdminProductSiblingVariant, CatalogCategory } from "@/types/admin";
import type { AdminDoorFinish } from "@/types/door-finish";

const STOCK_OPTIONS = [
  { value: "in_stock", label: "In Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const variantId = params.variantId as string;

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [finishes, setFinishes] = useState<AdminDoorFinish[]>([]);
  const [form, setForm] = useState({
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
  });
  const [productId, setProductId] = useState<number | null>(null);
  const [currentFinishId, setCurrentFinishId] = useState<number | null>(null);
  const [currentFinishName, setCurrentFinishName] = useState("");
  const [siblings, setSiblings] = useState<AdminProductSiblingVariant[]>([]);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [variantImages, setVariantImages] = useState<string[]>([]);
  const [finishImages, setFinishImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === form.categorySlug),
    [categories, form.categorySlug]
  );

  const currentFinish = useMemo(
    () => finishes.find((finish) => finish.id === currentFinishId) ?? null,
    [finishes, currentFinishId]
  );

  const suggestedVariantSku = useMemo(() => {
    const width = Number.parseFloat(form.widthIn);
    const height = Number.parseFloat(form.heightIn);
    const depth = Number.parseFloat(form.depthIn);

    if (!form.productSku || !currentFinishName || [width, height, depth].some(Number.isNaN)) {
      return "";
    }

    return buildVariantSku(form.productSku.toUpperCase(), currentFinishName, width, height, depth);
  }, [form.productSku, currentFinishName, form.widthIn, form.heightIn, form.depthIn]);

  const loadProduct = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [catalogResponse, finishesResponse, productResponse] = await Promise.all([
        fetch("/api/admin/catalog"),
        fetch("/api/admin/finishes"),
        fetch(`/api/admin/products/${variantId}`),
      ]);

      if (!catalogResponse.ok || !finishesResponse.ok) {
        throw new Error("Failed to load categories");
      }

      if (productResponse.status === 404) {
        setError("Product not found");
        return;
      }

      if (!productResponse.ok) {
        throw new Error("Failed to load product");
      }

      const catalogData = (await catalogResponse.json()) as {
        categories: CatalogCategory[];
      };
      const finishesData = (await finishesResponse.json()) as {
        finishes: AdminDoorFinish[];
      };
      const productData = (await productResponse.json()) as {
        product: AdminProductDetail;
      };

      const product = productData.product;

      setCategories(catalogData.categories);
      setFinishes(finishesData.finishes);
      setProductId(product.productId);
      setCurrentFinishId(product.finishId);
      setCurrentFinishName(product.finishName);
      setSiblings(product.siblings);
      setProductImages(product.productImages);
      setVariantImages(product.variantImages);
      setFinishImages(product.finishImages);
      setForm({
        categorySlug: product.categorySlug,
        subCategorySlug: product.subCategorySlug,
        productSku: product.productSku,
        productName: product.productName,
        description: product.description,
        widthIn: String(product.widthIn),
        heightIn: String(product.heightIn),
        depthIn: String(product.depthIn),
        stockStatus: product.stockStatus,
        price: String(product.price),
        variantSku: product.variantSku,
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load product"
      );
    } finally {
      setIsLoading(false);
    }
  }, [variantId]);

  useDeferredEffect(() => {
    void loadProduct();
  }, [loadProduct]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      if (currentFinishId === null) {
        throw new Error("Missing finish for this variant");
      }

      const payload: Record<string, unknown> = {
        categorySlug: form.categorySlug,
        subCategorySlug: form.subCategorySlug,
        productSku: form.productSku.trim().toUpperCase(),
        productName: form.productName.trim(),
        description: form.description.trim(),
        widthIn: Number.parseFloat(form.widthIn),
        heightIn: Number.parseFloat(form.heightIn),
        depthIn: Number.parseFloat(form.depthIn),
        finishIds: [currentFinishId],
        finishName: currentFinishName,
        stockStatus: form.stockStatus,
        price: Number.parseFloat(form.price),
        variantSku: form.variantSku.trim() || suggestedVariantSku,
      };

      const response = await fetch(`/api/admin/products/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string; detail?: AdminProductDetail };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update product");
      }

      setMessage("Product updated successfully.");

      if (data.detail) {
        setProductId(data.detail.productId);
        setCurrentFinishId(data.detail.finishId);
        setCurrentFinishName(data.detail.finishName);
        setSiblings(data.detail.siblings);

        if (String(data.detail.variantId) !== variantId) {
          router.replace(`/admin/products/${data.detail.variantId}/edit`);
        }
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to update product"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminShell
      wide
      title="Edit Product"
      subtitle={
        form.productSku
          ? `${form.productSku} · ${currentFinishName || "Finish"} · ${form.widthIn} × ${form.heightIn} × ${form.depthIn} in`
          : `Variant #${variantId}`
      }
    >
      <div className={`mb-6 ${ui.adminCard} px-5 py-4`}>
        <Link
          href="/admin/products/catalog"
          className="text-sm font-medium text-brand transition hover:text-brand-hover"
        >
          ← Back to catalog
        </Link>
      </div>

      {isLoading ? (
        <LoadingState label="Loading product..." minHeight="min-h-[320px]" spinnerSize="lg" />
      ) : error && !form.productName ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <Link href="/admin/products/catalog" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
            Back to catalog
          </Link>
        </div>
      ) : (
        <>
          <SiblingVariantsBar
            productSku={form.productSku}
            widthIn={Number.parseFloat(form.widthIn)}
            heightIn={Number.parseFloat(form.heightIn)}
            depthIn={Number.parseFloat(form.depthIn)}
            currentVariantId={Number.parseInt(variantId, 10)}
            siblings={siblings}
          />

          <AdminPanel className="sm:p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-brand/25 bg-brand-light/30 px-4 py-3 dark:border-brand/30 dark:bg-brand-light/10">
              <AdminFinishBadge finishName={currentFinishName} size="md" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-cream">
                  Editing this finish variant
                </p>
                <p className={`text-xs ${ui.bodyMuted}`}>
                  Price, stock, images, and variant SKU apply only to{" "}
                  <span className="font-medium text-slate-900 dark:text-cream">{currentFinishName}</span>.
                  Use the finish tabs above to edit other colors.
                </p>
              </div>
            </div>

          <form onSubmit={handleSubmit} className="space-y-8">
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
                        readOnly
                        value={form.productSku}
                        className="bg-slate-50 text-slate-500 dark:bg-navy-hover/50 dark:text-cream/75"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <AdminFieldLabel>Product name</AdminFieldLabel>
                      <AdminInput
                        required
                        value={form.productName}
                        onChange={(event) => updateField("productName", event.target.value)}
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
                title="Variant pricing"
                description="Price, stock, and SKU apply only to the current finish variant."
              >
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
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
                    <label className="block space-y-1.5">
                      <AdminFieldLabel>Variant SKU</AdminFieldLabel>
                      <AdminInput
                        required
                        value={form.variantSku}
                        onChange={(event) => updateField("variantSku", event.target.value)}
                        placeholder={suggestedVariantSku || "Variant SKU"}
                      />
                    </label>
                  </div>

                  {suggestedVariantSku && suggestedVariantSku !== form.variantSku && (
                    <p className={`text-xs ${ui.bodyMuted}`}>
                      Suggested SKU for {currentFinishName}: {suggestedVariantSku}
                    </p>
                  )}
                </div>
              </AdminFormSection>
            </div>

            <AdminFormSection
              title="Media gallery"
              description="Three-tier gallery: product drawings, shared finish photos, and optional variant overrides."
            >
              <ProductGalleryEditor
                variantId={Number.parseInt(variantId, 10)}
                productImages={productImages}
                variantImages={variantImages}
                finishImages={finishImages}
                finishName={currentFinishName}
                disabled={isSubmitting || !productId}
                onUpdated={(payload) => {
                  setProductImages(payload.productImages);
                  setVariantImages(payload.variantImages);
                  setFinishImages(payload.finishImages);
                }}
              />
            </AdminFormSection>

            {message && <AdminAlert tone="success">{message}</AdminAlert>}
            {error && <AdminAlert tone="error">{error}</AdminAlert>}

            <div className="flex flex-wrap gap-3">
              <AdminButton type="submit" variant="primary" size="md" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save changes"}
              </AdminButton>
              <AdminButton
                type="button"
                size="md"
                onClick={() => router.push("/admin/products/catalog")}
              >
                Cancel
              </AdminButton>
            </div>
          </form>
        </AdminPanel>
        </>
      )}
    </AdminShell>
  );
}
