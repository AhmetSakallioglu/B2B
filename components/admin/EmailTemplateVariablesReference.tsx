"use client";

import Link from "next/link";
import {
  COUPON_EMAIL_TEMPLATE_VARIABLES,
  EMAIL_TEMPLATE_VARIABLE_HELP,
  EMAIL_TEMPLATE_VARIABLES,
  type EmailTemplateVariable,
} from "@/types/email-template";
import { ui } from "@/lib/ui-classes";

type EmailTemplateVariablesReferenceProps = {
  mode: "coupons" | "full";
  defaultPromoExpiryDays?: number;
};

function VariableChip({ variable }: { variable: EmailTemplateVariable }) {
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-navy-hover/40">
      <code className="font-mono text-[11px] font-semibold text-brand">{`{{${variable}}}`}</code>
      <p className={`mt-1 text-xs leading-snug ${ui.bodyMuted}`}>
        {EMAIL_TEMPLATE_VARIABLE_HELP[variable]}
      </p>
    </div>
  );
}

export function EmailTemplateVariablesReference({
  mode,
  defaultPromoExpiryDays,
}: EmailTemplateVariablesReferenceProps) {
  const couponVariableSet = new Set<string>(COUPON_EMAIL_TEMPLATE_VARIABLES);
  const generalVariables = EMAIL_TEMPLATE_VARIABLES.filter(
    (variable) => !couponVariableSet.has(variable)
  );

  return (
    <details className="group rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-zinc-700/50 dark:bg-navy-hover/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:content-none">
        <div>
          <p className="text-sm font-semibold text-navy dark:text-cream">
            {mode === "coupons" ? "Email coupon placeholders" : "Template variables reference"}
          </p>
          <p className={`mt-0.5 text-xs ${ui.bodyMuted}`}>
            {mode === "coupons"
              ? "Optional reference — expand when editing email copy."
              : "Optional reference — expand to see all supported placeholders."}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200/80 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition group-open:rotate-180 dark:border-zinc-600 dark:text-cream/60">
          ▼
        </span>
      </summary>

      <div className="space-y-5 border-t border-slate-200/80 px-5 py-5 dark:border-zinc-700/50">
        {mode === "full" && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-cream/50">
              General
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {generalVariables.map((variable) => (
                <VariableChip key={variable} variable={variable} />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-cream/50">
            Coupon placeholders
          </p>
          {mode === "coupons" && (
            <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
              Enable <strong>Include personal coupon</strong> on a template. Codes expire after{" "}
              {defaultPromoExpiryDays ?? 7} days by default (
              <Link href="/admin/coupons" className="font-medium underline">
                Coupon settings
              </Link>
              ).
            </p>
          )}
          {mode === "full" && (
            <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
              Requires <strong>Include personal coupon</strong> on the template (
              {defaultPromoExpiryDays ?? 7} day default expiry).
            </p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {COUPON_EMAIL_TEMPLATE_VARIABLES.map((variable) => (
              <VariableChip key={variable} variable={variable} />
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-dashed border-slate-200/80 bg-white/60 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-600 dark:border-zinc-700/50 dark:bg-navy/40 dark:text-cream/75">
            Use code {"{{discount_code}}"} for {"{{discount_percent}}"}% off — valid until{" "}
            {"{{discount_expiry_short}}"}
          </p>
        </div>
      </div>
    </details>
  );
}
