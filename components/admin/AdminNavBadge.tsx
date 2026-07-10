type AdminNavBadgeProps = {
  count: number;
  active?: boolean;
  label: string;
};

export function AdminNavBadge({ count, active = false, label }: AdminNavBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <span
      aria-label={`${displayCount} ${label}`}
      className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none animate-pulse ${
        active ? "bg-white text-red-600" : "bg-red-500 text-white"
      }`}
    >
      {displayCount}
    </span>
  );
}
