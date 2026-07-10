type AdminFinishBadgeProps = {
  finishName: string;
  size?: "sm" | "md";
  className?: string;
};

export function AdminFinishBadge({
  finishName,
  size = "sm",
  className = "",
}: AdminFinishBadgeProps) {
  const sizeClasses =
    size === "md"
      ? "px-3 py-1 text-xs"
      : "px-2.5 py-1 text-[10px]";

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border border-brand/25 bg-brand-light font-semibold uppercase tracking-wide text-brand dark:text-brand ${sizeClasses} ${className}`}
      title={`Door finish: ${finishName}`}
    >
      <span className="truncate">{finishName}</span>
    </span>
  );
}
