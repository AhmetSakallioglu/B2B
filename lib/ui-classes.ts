/**
 * Premium B2B SaaS design tokens — Tailwind class strings only.
 * Import and spread onto elements; do not change component logic.
 */
export const ui = {
  pageContainer: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
  pageContainerNarrow: "mx-auto max-w-5xl px-4 sm:px-6 lg:px-8",
  sectionStack: "space-y-6",
  pageBg:
    "min-h-full bg-linear-to-br from-slate-50/80 via-white to-slate-50/50 dark:from-navy dark:via-navy-hover dark:to-navy",

  /** Admin shell — slate canvas with floating white cards */
  adminPageBg: "min-h-full bg-[#f8fafc] dark:from-navy dark:via-navy-hover dark:to-navy",
  adminCardShadow:
    "shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-12px_rgba(0,0,0,0.05)]",
  adminCard:
    "rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-12px_rgba(0,0,0,0.05)] dark:border-zinc-700/50 dark:bg-navy",
  adminCardInteractive:
    "rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-12px_rgba(0,0,0,0.05)] transition duration-200 hover:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.08),0_14px_28px_-12px_rgba(0,0,0,0.08)] dark:border-zinc-700/50 dark:bg-navy",
  adminHeaderBar:
    "border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl dark:border-zinc-700/50 dark:bg-navy/95",
  adminActionBar: "border-t border-slate-200/80 bg-slate-50/90 dark:border-zinc-700/50 dark:bg-navy-hover/50",

  /** Customer catalog — same layered canvas as admin */
  catalogPageBg: "min-h-full bg-[#f8fafc] dark:from-navy dark:via-navy-hover dark:to-navy",
  catalogCard:
    "rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-12px_rgba(0,0,0,0.05)] dark:border-zinc-700/50 dark:bg-navy",
  catalogProductCard:
    "group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-zinc-700/50 dark:bg-navy",
  catalogPillActive:
    "rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/20 ring-2 ring-brand/25 transition duration-200",
  catalogPillIdle:
    "rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition duration-200 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700/50 dark:bg-navy dark:text-cream/90 dark:hover:bg-navy-hover",
  catalogSubPillActive:
    "rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition duration-200",
  catalogSubPillIdle:
    "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition duration-200 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700/50 dark:bg-navy dark:text-cream/85 dark:hover:bg-navy-hover",
  badgeInStock:
    "rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  badgeOutOfStock:
    "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",

  /** Shared admin/customer tab bars */
  tabBar:
    "inline-flex rounded-2xl border border-slate-200/60 bg-white p-1.5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-12px_rgba(0,0,0,0.05)] dark:border-zinc-700/50 dark:bg-navy",
  tabActive:
    "rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition duration-200 dark:bg-brand",
  tabIdle:
    "rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition duration-200 hover:bg-slate-50 hover:text-slate-900 dark:text-cream/65 dark:hover:bg-navy-hover dark:hover:text-cream",

  fieldLabel:
    "text-sm font-medium text-slate-600 dark:text-cream/80",

  brandWordmark:
    "text-[1.35rem] font-bold leading-none tracking-tight text-slate-900 sm:text-[1.5rem] dark:text-cream",
  brandSubtitle:
    "text-sm font-medium leading-snug text-slate-500 dark:text-cream/70",

  heading1: "text-2xl font-bold tracking-tight text-slate-900 dark:text-cream",
  heading2: "text-xl font-semibold tracking-tight text-slate-900 dark:text-cream",
  heading3: "text-lg font-semibold tracking-tight text-slate-900 dark:text-cream",
  eyebrow: "text-xs font-semibold uppercase tracking-[0.08em] text-brand",
  body: "text-sm leading-relaxed text-slate-700 dark:text-cream/90",
  bodyMuted: "text-sm leading-relaxed text-slate-500 dark:text-cream/65",

  card: "rounded-2xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-700/40 dark:bg-navy",
  cardMuted:
    "rounded-2xl border border-zinc-200/60 bg-slate-50/50 shadow-sm dark:border-zinc-700/40 dark:bg-navy-hover/40",
  cardInteractive:
    "rounded-2xl border border-zinc-200/60 bg-white shadow-sm transition duration-200 hover:shadow-md dark:border-zinc-700/40 dark:bg-navy",

  headerBar:
    "border-b border-zinc-200/70 bg-white/85 backdrop-blur-xl dark:border-zinc-700/50 dark:bg-navy/90",

  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/20 transition duration-200 hover:scale-[1.01] hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition duration-200 hover:scale-[1.01] hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] dark:border-zinc-700/50 dark:bg-navy dark:text-cream dark:hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 transition duration-200 hover:scale-[1.01] hover:bg-slate-100 active:scale-[0.99] dark:text-cream/75 dark:hover:bg-navy-hover",
  /** White surface button — client quote actions, secondary CTAs on cards */
  btnSurface:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:border-slate-600 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100",
  /** Brand-outline button — white-label quote download, outline accent */
  btnOutlineBrand:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-brand/35 bg-white px-4 py-2.5 text-sm font-semibold text-brand shadow-sm transition duration-200 hover:border-brand/50 hover:bg-brand-light/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:border-brand/40 dark:bg-navy dark:text-brand dark:hover:bg-brand-light/10",
  btnNavActive:
    "inline-flex items-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-200",
  btnNavIdle:
    "inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition duration-200 hover:scale-[1.01] hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] dark:border-zinc-700/50 dark:bg-navy dark:text-cream/90 dark:hover:bg-navy-hover",

  input:
    "w-full rounded-xl border border-slate-300/80 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 outline-none transition duration-200 focus:border-brand focus:ring-2 focus:ring-brand-ring dark:border-zinc-700/50 dark:bg-navy dark:text-cream dark:placeholder:text-cream/35",
  select:
    "rounded-xl border border-slate-300/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none transition duration-200 focus:border-brand focus:ring-2 focus:ring-brand-ring dark:border-zinc-600/50 dark:bg-navy dark:text-cream",

  /** Native file input — styles the "Choose file" control via file: pseudo */
  fileInput:
    "block w-full cursor-pointer rounded-xl border border-dashed border-slate-300/80 bg-slate-50/60 px-4 py-3 text-sm text-slate-600 transition duration-200 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-sm hover:border-brand/40 hover:bg-brand-light/10 hover:file:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600/50 dark:bg-navy-hover/30 dark:text-cream/70 dark:hover:border-brand/35",

  tableWrap: "overflow-x-auto rounded-2xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-700/40 dark:bg-navy",
  tableHead:
    "border-b border-zinc-200/70 bg-slate-50/80 text-xs font-semibold text-slate-500 dark:border-zinc-700/50 dark:bg-navy-hover/50 dark:text-cream/60",
  tableHeadCell: "px-6 py-3.5 font-medium",
  tableRow:
    "border-b border-zinc-100 transition-colors duration-200 last:border-b-0 hover:bg-slate-50/80 dark:border-zinc-800/80 dark:hover:bg-navy-hover/40",
  tableCell: "px-6 py-4",

  emptyState:
    "rounded-2xl border border-dashed border-zinc-200/80 bg-slate-50/40 px-6 py-16 text-center dark:border-zinc-700/50 dark:bg-navy/40",
} as const;
