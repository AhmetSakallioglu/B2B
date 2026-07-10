import { ui } from "@/lib/ui-classes";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/80 dark:bg-navy-hover/80 ${className}`.trim()}
      aria-hidden
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className={`space-y-3 p-5 ${ui.adminCard}`}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      {lines > 2 && <Skeleton className="h-3 w-40" />}
    </div>
  );
}
