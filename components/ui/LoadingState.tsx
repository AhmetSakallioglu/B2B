import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ui } from "@/lib/ui-classes";

type LoadingStateProps = {
  label?: string;
  fullScreen?: boolean;
  minHeight?: string;
  className?: string;
  spinnerSize?: "sm" | "md" | "lg";
};

export function LoadingState({
  label,
  fullScreen = false,
  minHeight = "min-h-48",
  className = "",
  spinnerSize = "md",
}: LoadingStateProps) {
  const wrapperClass = fullScreen
    ? `flex min-h-full items-center justify-center px-4 ${ui.catalogPageBg} ${className}`
    : `flex ${minHeight} items-center justify-center px-4 ${className}`;

  return (
    <div className={wrapperClass} role="status" aria-live="polite" aria-busy="true">
      <div className="flex flex-col items-center gap-3 text-center">
        <LoadingSpinner size={spinnerSize} />
        {label ? (
          <p className={ui.bodyMuted}>{label}</p>
        ) : null}
      </div>
    </div>
  );
}
