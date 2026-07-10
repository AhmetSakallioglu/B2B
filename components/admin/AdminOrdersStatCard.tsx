import type { ReactNode } from "react";
import { ui } from "@/lib/ui-classes";

type AdminOrdersStatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: "default" | "brand" | "amber" | "emerald" | "blue";
};

const accentStyles = {
  default: {
    icon: "border border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-600 dark:bg-navy-hover dark:text-cream",
  },
  brand: {
    icon: "border border-brand/30 bg-brand-light text-brand dark:border-brand/40 dark:bg-brand-light/20",
  },
  amber: {
    icon: "border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300",
  },
  emerald: {
    icon: "border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  blue: {
    icon: "border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300",
  },
} as const;

export function AdminOrdersStatCard({
  label,
  value,
  hint,
  icon,
  accent = "default",
}: AdminOrdersStatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div className={`p-5 ${ui.adminCard}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-cream/65">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-cream">
            {value}
          </p>
          {hint && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-cream/60">{hint}</p>
          )}
        </div>
        {icon && (
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();

  if (!source) {
    return "?";
  }

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function CustomerAvatar({
  companyName,
  contactName,
  email,
}: {
  companyName: string;
  contactName: string;
  email: string;
}) {
  const displayName = companyName || contactName || email;
  const initials = getInitials(contactName || companyName, email);

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-brand-light text-sm font-bold text-brand dark:border-brand/35 dark:bg-brand-light/20">
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900 dark:text-cream">{displayName}</p>
        <p className="truncate text-sm text-slate-500 dark:text-cream/65">{email}</p>
      </div>
    </div>
  );
}
