"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { ProductCatalogImage } from "@/components/catalog/ProductCatalogImage";
import { ui } from "@/lib/ui-classes";
import type { CatalogProduct } from "@/types/catalog";

type CatalogProductCardGalleryProps = {
  product: CatalogProduct;
  isOutOfStock: boolean;
  compact?: boolean;
};

export function CatalogProductCardGallery({
  product,
  isOutOfStock,
  compact = false,
}: CatalogProductCardGalleryProps) {
  const images = useMemo(() => {
    const unique = [...new Set(product.images.filter(Boolean))];

    if (unique.length > 0) {
      return unique;
    }

    return product.image ? [product.image] : [];
  }, [product.image, product.images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiple = images.length > 1;
  const currentIndex =
    images.length === 0 ? 0 : Math.min(activeIndex, images.length - 1);
  const displayImage = images[currentIndex] ?? "";

  const showPrevious = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveIndex((current) => (current === 0 ? images.length - 1 : current - 1));
  };

  const showNext = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveIndex((current) => (current === images.length - 1 ? 0 : current + 1));
  };

  const showImage = (event: MouseEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveIndex(index);
  };

  const pad = compact ? "p-2" : "p-3";
  const navSize = compact ? "h-7 w-7 text-sm" : "h-9 w-9 text-lg";
  const badgeText = compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const stockBadge = compact ? `${ui.badgeInStock} !px-2 !py-0.5 !text-[10px]` : ui.badgeInStock;
  const stockBadgeOut = compact
    ? `${ui.badgeOutOfStock} !px-2 !py-0.5 !text-[10px]`
    : ui.badgeOutOfStock;

  return (
    <div className={`relative isolate ${pad}`}>
      <div
        className={`relative z-0 overflow-hidden rounded-lg bg-white ${compact ? "aspect-square p-2" : "aspect-4/3 p-3"}`}
      >
        <ProductCatalogImage
          src={displayImage}
          alt={product.name}
          className="h-full w-full object-contain"
        />
      </div>

      <div className="pointer-events-none absolute inset-2 z-10 sm:inset-3">
        <span
          className={`absolute left-0 top-0 rounded-md border border-slate-200/80 bg-white/95 font-semibold text-slate-900 shadow-sm backdrop-blur ${badgeText}`}
        >
          {product.productSku}
        </span>

        <span
          className={`absolute right-0 top-0 ${isOutOfStock ? stockBadgeOut : stockBadge}`}
        >
          {product.stockStatus}
        </span>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Previous image"
              className={`pointer-events-auto absolute left-0 top-1/2 flex ${navSize} -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="Next image"
              className={`pointer-events-auto absolute right-0 top-1/2 flex ${navSize} -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white`}
            >
              ›
            </button>

            <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={(event) => showImage(event, index)}
                  aria-label={`Show image ${index + 1}`}
                  className={`pointer-events-auto rounded-full transition ${
                    compact ? "h-1.5 w-1.5" : "h-2 w-2"
                  } ${index === currentIndex ? "bg-brand" : "bg-slate-300 hover:bg-slate-400"}`}
                />
              ))}
            </div>

            <span className="absolute bottom-0 right-0 rounded-md border border-slate-200/80 bg-white/95 px-1.5 py-0.5 text-[9px] font-medium text-slate-700 shadow-sm backdrop-blur">
              {currentIndex + 1}/{images.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
