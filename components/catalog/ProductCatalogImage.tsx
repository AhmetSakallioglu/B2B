import Image from "next/image";
import {
  PRODUCT_CARD_GALLERY_SIZES,
  PRODUCT_IMAGE_BLUR_DATA_URL,
} from "@/lib/image-blur";

type ProductCatalogImageProps = {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  className?: string;
};

export function ProductCatalogImage({
  src,
  alt,
  sizes = PRODUCT_CARD_GALLERY_SIZES,
  priority = false,
  placeholder = "blur",
  className = "object-cover transition duration-500 group-hover:scale-105",
}: ProductCatalogImageProps) {
  if (!src) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cream-dark text-muted dark:bg-navy-hover dark:text-cream/60">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-surface/70 dark:border-border dark:bg-navy/50">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-7 w-7"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
            <path d="M3 16l5-5 4 4 3-3 6 6" />
          </svg>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-cream/55">
          No image
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      placeholder={placeholder}
      blurDataURL={placeholder === "blur" ? PRODUCT_IMAGE_BLUR_DATA_URL : undefined}
      className={className}
    />
  );
}
