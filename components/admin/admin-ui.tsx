"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { ui } from "@/lib/ui-classes";

export function AdminPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${ui.adminCard} p-6 ${className}`}>
      {children}
    </section>
  );
}

export function AdminFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className={ui.heading3}>{title}</h3>
        {description && <p className={`mt-1.5 ${ui.bodyMuted}`}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function AdminListCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`${ui.adminCard} p-4 ${className}`}>
      {children}
    </article>
  );
}

type AdminButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANTS: Record<AdminButtonVariant, string> = {
  primary: ui.btnPrimary,
  secondary: ui.btnSecondary,
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition duration-200 hover:scale-[1.01] hover:bg-red-100 active:scale-[0.99] dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50",
  ghost: ui.btnGhost,
};

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant;
  size?: "sm" | "md";
};

export function AdminButton({
  variant = "secondary",
  size = "sm",
  className = "",
  ...props
}: AdminButtonProps) {
  const sizeClass =
    size === "md" ? "px-4 py-2.5 text-sm font-semibold" : "px-3.5 py-2 text-xs font-semibold";

  return (
    <button
      className={`disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${BUTTON_VARIANTS[variant]} ${sizeClass} ${className}`}
      {...props}
    />
  );
}

export function AdminFieldLabel({ children }: { children: ReactNode }) {
  return <span className={ui.fieldLabel}>{children}</span>;
}

export function AdminInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${ui.input} ${className}`} {...props} />;
}

export function AdminTextarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${ui.input} min-h-[100px] resize-y ${className}`} {...props} />;
}

export function AdminSelect({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${ui.select} ${className}`} {...props} />;
}

type AdminBadgeTone = "success" | "neutral" | "brand" | "danger";

const BADGE_TONES: Record<AdminBadgeTone, string> = {
  success:
    "border border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-200",
  neutral:
    "border border-zinc-200/60 bg-slate-50 text-zinc-600 dark:border-zinc-700/50 dark:bg-navy-hover dark:text-cream/75",
  brand: "border border-brand/25 bg-brand-light text-brand dark:text-brand",
  danger:
    "border border-red-200/60 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-300",
};

export function AdminBadge({
  tone = "neutral",
  children,
}: {
  tone?: AdminBadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function AdminAlert({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <p
      className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
        tone === "success"
          ? "border-brand/20 bg-brand-light text-navy dark:text-cream"
          : "border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      }`}
    >
      {children}
    </p>
  );
}

export function AdminActionRow({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap gap-2">{children}</div>;
}

export function AdminListStack({ children }: { children: ReactNode }) {
  return (
    <div className={`mt-6 ${ui.sectionStack}`}>
      {children}
    </div>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return <p className={`mt-6 ${ui.emptyState} text-sm ${ui.bodyMuted}`}>{children}</p>;
}

export function AdminLink({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link className={`${ui.btnSecondary} text-xs font-semibold ${className}`} {...props}>
      {children}
    </Link>
  );
}
