"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { QuantitySelector } from "@/components/cart/QuantitySelector";
import { CatalogSiteHeader } from "@/components/catalog/CatalogSiteHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { StoreIcon } from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { ProductCatalogImage } from "@/components/catalog/ProductCatalogImage";
import { ProductImageLightbox } from "@/components/catalog/ProductImageLightbox";
import {
  PRODUCT_GALLERY_MAIN_SIZES,
  PRODUCT_GALLERY_THUMB_SIZES,
} from "@/lib/image-blur";
import { useSession } from "@/components/auth/SessionProvider";
import { useCartStore } from "@/store/useCartStore";
import { buildCartItemLabel } from "@/lib/format-dimensions";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";
import type { CatalogProductDetail } from "@/types/catalog";

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function ProductDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const variantId = params.variantId as string;
  const finishSlug = searchParams.get("finish") ?? "";

  const [product, setProduct] = useState<CatalogProductDetail | null>(null);
  const [pricesVisible, setPricesVisible] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const items = useCartStore((state) => state.items);
  const isAdmin = user?.role === "admin";

  const loadProduct = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const productResponse = await fetch(`/api/products/${variantId}`);

      if (productResponse.status === 404) {
        setError("Product not found");
        return;
      }

      if (!productResponse.ok) {
        throw new Error("Failed to load product");
      }

      const productData = (await productResponse.json()) as {
        product: CatalogProductDetail;
        pricesVisible?: boolean;
      };

      setProduct(productData.product);
      setPricesVisible(productData.pricesVisible === true);
      setActiveImageIndex(0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load product");
    } finally {
      setIsLoading(false);
    }
  }, [variantId]);

  useDeferredEffect(() => {
    void loadProduct();
  }, [loadProduct, user?.id]);

  const galleryImages = useMemo(() => {
    if (!product) {
      return [];
    }

    if (product.images.length > 0) {
      return product.images;
    }

    return product.image ? [product.image] : [];
  }, [product]);

  const activeImage = galleryImages[activeImageIndex] ?? "";
  const hasMultipleImages = galleryImages.length > 1;

  const showPreviousImage = useCallback(() => {
    setActiveImageIndex((current) =>
      current === 0 ? galleryImages.length - 1 : current - 1
    );
  }, [galleryImages.length]);

  const showNextImage = useCallback(() => {
    setActiveImageIndex((current) =>
      current === galleryImages.length - 1 ? 0 : current + 1
    );
  }, [galleryImages.length]);

  useDeferredEffect(() => {
    if (activeImageIndex >= galleryImages.length) {
      setActiveImageIndex(0);
    }
  }, [activeImageIndex, galleryImages.length]);

  const inCart = items.find((item) => item.id === variantId);
  const isOutOfStock = product?.stockStatus === "Out of Stock";
  const catalogHref = finishSlug ? `/catalog?finish=${encodeURIComponent(finishSlug)}` : "/";

  if (isLoading) {
    return <LoadingState fullScreen label="Loading product..." spinnerSize="lg" />;
  }

  if (error || !product) {
    return (
      <div className={`flex min-h-full items-center justify-center px-4 ${ui.catalogPageBg}`}>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">{error ?? "Product not found"}</p>
          <Link
            href={catalogHref}
            className="mt-4 inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm text-white"
          >
            <IconLabel icon={<StoreIcon size={15} />}>Back to catalog</IconLabel>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={ui.catalogPageBg}>
      <CatalogSiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 xl:px-8">
        <div className="mb-6">
          <Link
            href={catalogHref}
            className={`inline-flex items-center text-sm font-medium text-brand transition hover:text-brand-hover`}
          >
            <IconLabel icon={<StoreIcon size={15} />}>Back to catalog</IconLabel>
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="space-y-4">
            <div className={`relative aspect-4/3 w-full overflow-hidden p-6 ${ui.catalogCard}`}>
              <button
                type="button"
                onClick={() => {
                  if (activeImage) {
                    setIsLightboxOpen(true);
                  }
                }}
                disabled={!activeImage}
                className="group relative h-full w-full cursor-zoom-in rounded-xl bg-white p-3 transition hover:ring-2 hover:ring-brand/30 disabled:cursor-not-allowed"
                aria-label={`View ${product.name} image full screen`}
              >
                <div className="relative h-full w-full">
                  <ProductCatalogImage
                    src={activeImage}
                    alt={product.name}
                    sizes={PRODUCT_GALLERY_MAIN_SIZES}
                    priority
                    className="object-contain"
                  />
                </div>
                {activeImage && (
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-slate-200/80 bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100">
                    Click to zoom
                  </span>
                )}
              </button>

              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    onClick={showPreviousImage}
                    aria-label="Previous image"
                    className="absolute left-4 top-1/2 z-[1] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-xl text-white backdrop-blur transition hover:bg-black/65"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    aria-label="Next image"
                    className="absolute right-4 top-1/2 z-[1] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-xl text-white backdrop-blur transition hover:bg-black/65"
                  >
                    ›
                  </button>
                  <span className="absolute bottom-4 right-4 z-[1] rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                    {activeImageIndex + 1}/{galleryImages.length}
                  </span>
                </>
              )}
            </div>
            {hasMultipleImages && (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {galleryImages.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`relative aspect-square overflow-hidden rounded-xl border bg-white p-2 dark:bg-navy/90 ${
                      activeImageIndex === index
                        ? "border-brand ring-2 ring-brand-ring shadow-sm"
                        : "border-slate-200/60 hover:border-slate-300 dark:border-zinc-700/50"
                    }`}
                  >
                    <div className="relative h-full w-full">
                      <ProductCatalogImage
                        src={url}
                        alt={product.name}
                        sizes={PRODUCT_GALLERY_THUMB_SIZES}
                        className="object-contain"
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`p-6 ${ui.catalogCard}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              {product.subCategory}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-cream">
              {product.name}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-cream/70">
              SKU {product.productSku} · {product.color} · {product.variantSku}
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-cream/80">
              {product.description}
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              {[
                { label: "W", value: product.width },
                { label: "H", value: product.height },
                { label: "D", value: product.depth },
              ].map((dimension) => (
                <div
                  key={dimension.label}
                  className="rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3 dark:border-zinc-700/50 dark:bg-navy/60"
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {dimension.label}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-cream">
                    {dimension.value}
                  </span>
                </div>
              ))}
            </div>

            {(pricesVisible || isOutOfStock) && (
              <div className="mt-6 flex items-center justify-between gap-4">
                {pricesVisible && typeof product.price === "number" ? (
                  <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-brand">
                    {formatPrice(product.price)}
                  </p>
                ) : (
                  <div />
                )}
                <span
                  className={
                    isOutOfStock ? ui.badgeOutOfStock : ui.badgeInStock
                  }
                >
                  {product.stockStatus}
                </span>
              </div>
            )}

            {pricesVisible && (
              <div className="mt-6 space-y-3 border-t border-slate-200/80 pt-6 dark:border-zinc-700/50">
                {!isAdmin && !isOutOfStock && (
                  <p className="text-sm font-semibold text-slate-700 dark:text-cream/70">Quantity</p>
                )}

                <div className="flex items-center gap-3">
                  {!isAdmin && !isOutOfStock && (
                    <QuantitySelector
                      value={quantity}
                      onChange={setQuantity}
                      disabled={isOutOfStock}
                      className="shrink-0"
                    />
                  )}
                  <AddToCartButton
                    item={{
                      id: product.id,
                      name: buildCartItemLabel(
                        product.productSku,
                        product.color,
                        product.width,
                        product.height,
                        product.depth
                      ),
                      width: product.width,
                      height: product.height,
                      depth: product.depth,
                      price: product.price!,
                    }}
                    quantity={quantity}
                    inCart={Boolean(inCart)}
                    isAdmin={isAdmin}
                    isOutOfStock={isOutOfStock}
                    size="md"
                    fullWidth={isAdmin || isOutOfStock}
                  />
                </div>

                {!isAdmin && !isOutOfStock && typeof product.price === "number" && quantity > 1 && (
                  <p className="text-sm text-slate-500 dark:text-cream/70">
                    {formatPrice(product.price)} each · {formatPrice(product.price * quantity)} total
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <ProductImageLightbox
        images={galleryImages}
        currentIndex={activeImageIndex}
        alt={product.name}
        open={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onPrevious={showPreviousImage}
        onNext={showNextImage}
      />
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={<LoadingState fullScreen label="Loading product..." spinnerSize="lg" />}
    >
      <ProductDetailContent />
    </Suspense>
  );
}
