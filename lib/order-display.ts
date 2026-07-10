import {
  ORDER_STATUS_OPTIONS,
  type OrderStatus,
} from "@/lib/order-status";

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function statusBadgeClass(status: string) {
  switch (status as OrderStatus) {
    case "pending":
      return "border border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-200";
    case "processing":
    case "confirmed":
      return "border border-blue-200/80 bg-blue-50 text-blue-800 dark:border-blue-800/50 dark:bg-blue-950/35 dark:text-blue-200";
    case "shipped":
      return "border border-indigo-200/80 bg-indigo-50 text-indigo-800 dark:border-indigo-800/50 dark:bg-indigo-950/35 dark:text-indigo-200";
    case "completed":
      return "border border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-200";
    case "cancelled":
      return "border border-slate-300/80 bg-slate-100 text-slate-700 dark:border-zinc-600/50 dark:bg-zinc-900/40 dark:text-slate-300";
    case "waiting_for_modification_payment":
      return "border border-orange-300/80 bg-orange-50 text-orange-900 dark:border-orange-800/50 dark:bg-orange-950/35 dark:text-orange-200";
    default:
      return "border border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-200";
  }
}

/** White card on slate admin canvas — status shown via left accent stripe */
export function orderStatusSurfaceClass(_status: OrderStatus) {
  return "border-slate-200/60 bg-white dark:border-zinc-700/50 dark:bg-navy";
}

export function orderStatusAccentClass(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "border-l-4 border-l-amber-500 dark:border-l-amber-400";
    case "processing":
    case "confirmed":
      return "border-l-4 border-l-blue-500 dark:border-l-blue-400";
    case "shipped":
      return "border-l-4 border-l-indigo-500 dark:border-l-indigo-400";
    case "completed":
      return "border-l-4 border-l-emerald-500 dark:border-l-emerald-400";
    case "cancelled":
      return "border-l-4 border-l-slate-400 dark:border-l-slate-500";
    case "waiting_for_modification_payment":
      return "border-l-4 border-l-orange-500 dark:border-l-orange-400";
  }
}

export function statusLabel(status: string) {
  return (
    ORDER_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    "Pending"
  );
}
