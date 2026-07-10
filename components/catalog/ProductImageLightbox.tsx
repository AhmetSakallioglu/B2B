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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
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

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPrevious();
            }}
            aria-label="Previous image"
            className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-2xl text-white backdrop-blur transition hover:bg-black/70"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNext();
            }}
            aria-label="Next image"
            className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-2xl text-white backdrop-blur transition hover:bg-black/70"
          >
            ›
          </button>
          <span className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white backdrop-blur">
            {currentIndex + 1} / {images.length}
          </span>
        </>
      )}

      <div
        className="relative z-10 flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt}
          width={1600}
          height={1200}
          className="h-auto max-h-[90vh] w-auto max-w-[90vw] object-contain"
          sizes="90vw"
          placeholder="blur"
          blurDataURL={PRODUCT_IMAGE_BLUR_DATA_URL}
        />
      </div>
    </div>
  );
}
