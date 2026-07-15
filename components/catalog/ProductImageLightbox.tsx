"use client";

import Image from "next/image";
import { useEffect } from "react";
import { PRODUCT_IMAGE_BLUR_DATA_URL } from "@/lib/image-blur";

type ProductImageLightboxProps = {
  images: string[];
  currentIndex: number;
  alt: string;
  open: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

const navButtonClassName =
  "flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/20 bg-black/60 text-2xl text-white backdrop-blur transition hover:bg-black/80 sm:h-12 sm:w-12";

export function ProductImageLightbox({
  images,
  currentIndex,
  alt,
  open,
  onClose,
  onPrevious,
  onNext,
}: ProductImageLightboxProps) {
  const src = images[currentIndex] ?? "";
  const hasMultiple = images.length > 1;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (!hasMultiple) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevious();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [hasMultiple, onClose, onNext, onPrevious, open]);

  if (!open || !src) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} enlarged view`}
    >
      <button
        type="button"
        aria-label="Close image preview"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-30 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 sm:right-4 sm:top-4"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-2 pb-12 pt-14 sm:px-4 sm:pb-14 sm:pt-16">
        <div
          className="pointer-events-auto flex w-full max-w-6xl items-center gap-2 sm:gap-4"
          onClick={(event) => event.stopPropagation()}
        >
          {hasMultiple ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPrevious();
              }}
              aria-label="Previous image"
              className={navButtonClassName}
            >
              ‹
            </button>
          ) : (
            <div className="hidden w-11 shrink-0 sm:block sm:w-12" aria-hidden="true" />
          )}

          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
            <Image
              src={src}
              alt={alt}
              width={1600}
              height={1200}
              className="pointer-events-none h-auto max-h-[calc(100vh-7rem)] w-auto max-w-full object-contain"
              sizes="(max-width: 640px) 100vw, 80vw"
              placeholder="blur"
              blurDataURL={PRODUCT_IMAGE_BLUR_DATA_URL}
            />
          </div>

          {hasMultiple ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onNext();
              }}
              aria-label="Next image"
              className={navButtonClassName}
            >
              ›
            </button>
          ) : (
            <div className="hidden w-11 shrink-0 sm:block sm:w-12" aria-hidden="true" />
          )}
        </div>
      </div>

      {hasMultiple && (
        <span className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white backdrop-blur">
          {currentIndex + 1} / {images.length}
        </span>
      )}
    </div>
  );
}
