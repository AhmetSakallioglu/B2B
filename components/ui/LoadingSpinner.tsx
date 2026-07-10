type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  variant?: "brand" | "light";
  className?: string;
};

const SIZE_CLASSES = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
} as const;

const VARIANT_CLASSES = {
  brand: "border-brand/20 border-t-brand",
  light: "border-white/25 border-t-white",
} as const;

export function LoadingSpinner({
  size = "md",
  variant = "brand",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
