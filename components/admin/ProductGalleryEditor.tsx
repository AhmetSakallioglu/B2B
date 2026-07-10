"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AdminAlert } from "@/components/admin/admin-ui";
import { ImageArrayManager } from "@/components/admin/ImageArrayManager";
import { ProductCatalogImage } from "@/components/catalog/ProductCatalogImage";
import { ui } from "@/lib/ui-classes";

type ProductGalleryEditorProps = {
  variantId: number;
  productImages: string[];
  variantImages: string[];
  finishImages: string[];
  finishName: string;
  disabled?: boolean;
  onUpdated?: (payload: {
    productImages: string[];
    variantImages: string[];
    finishImages: string[];
  }) => void;
};

export function ProductGalleryEditor({
  variantId,
  productImages,
  variantImages,
  finishImages,
  finishName,
  disabled = false,
  onUpdated,
}: ProductGalleryEditorProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveGallery = useCallback(
    async (payload: { productImages?: string[]; variantImages?: string[] | null }) => {
      setMessage(null);
      setError(null);

      const response = await fetch(`/api/admin/products/${variantId}/gallery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        productImages?: string[];
        variantImages?: string[];
        finishImages?: string[];
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save gallery");
      }

      onUpdated?.({
        productImages: data.productImages ?? productImages,
        variantImages: data.variantImages ?? variantImages,
        finishImages: data.finishImages ?? finishImages,
      });

      setMessage("Gallery updated.");
    },
    [variantId, productImages, variantImages, finishImages, onUpdated]
  );

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-brand/25 bg-brand-light/30 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-brand/30 dark:bg-brand-light/10 dark:text-cream/85">
        Finish images are automatically pulled from the global finish settings. Manage shared{" "}
        <span className="font-medium">{finishName}</span> lifestyle photos on the{" "}
        <Link href="/admin/finishes" className="font-medium text-brand underline-offset-2 hover:underline">
          Door Finishes
        </Link>{" "}
        page.
      </div>

      {finishImages.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">
              Shared finish gallery ({finishName})
            </h3>
            <p className={`mt-1 ${ui.bodyMuted}`}>
              Preview of images shared across all {finishName} variants.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {finishImages.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="relative aspect-square overflow-hidden rounded-xl border border-slate-200/60 bg-white p-2 dark:border-zinc-700/50 dark:bg-navy"
              >
                <ProductCatalogImage src={url} alt={`${finishName} finish`} className="object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">
            Product images (technical drawings)
          </h3>
          <p className={`mt-1 ${ui.bodyMuted}`}>
            Shared across all finish variants of this cabinet — line drawings, dimensions, and skeleton views.
          </p>
        </div>
        <ImageArrayManager
          images={productImages}
          disabled={disabled}
          emptyHint="Upload technical drawings or shared product photos."
          onSave={async (images) => {
            await saveGallery({ productImages: images });
          }}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">
            Variant override images (optional)
          </h3>
          <p className={`mt-1 ${ui.bodyMuted}`}>
            Only for this specific size and finish combination. Leave empty to rely on product and finish galleries.
          </p>
        </div>
        <ImageArrayManager
          images={variantImages}
          disabled={disabled}
          emptyHint="Optional — add only when this variant needs unique photos."
          onSave={async (images) => {
            await saveGallery({ variantImages: images.length > 0 ? images : null });
          }}
        />
      </section>

      {message && <AdminAlert tone="success">{message}</AdminAlert>}
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
    </div>
  );
}
