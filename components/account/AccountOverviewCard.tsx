import type { ReactNode } from "react";
import {
  CheckCircleIcon,
  UserIcon,
} from "@/components/ui/Icon";
import { TAX_EXEMPTION_STATUS_LABELS } from "@/types/tax-exemption";
import { ui } from "@/lib/ui-classes";
import type { UserProfile } from "@/types/account";

type AccountOverviewCardProps = {
  profile: UserProfile;
  profileReadyForOrders: boolean;
};

function companyInitials(profile: UserProfile) {
  const source = profile.companyName.trim() || profile.contactName.trim() || profile.email;

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function AccountOverviewCard({
  profile,
  profileReadyForOrders,
}: AccountOverviewCardProps) {
  const displayName = profile.companyName.trim() || profile.contactName.trim() || "Your company";
  const taxLabel =
    profile.isTaxExempt && profile.taxExemptionStatus === "APPROVED"
      ? "Tax exempt"
      : TAX_EXEMPTION_STATUS_LABELS[profile.taxExemptionStatus];

  return (
    <section className={`overflow-hidden ${ui.catalogCard}`}>
      <div className="bg-linear-to-br from-brand-light/25 via-white to-slate-50/80 px-5 py-5 dark:from-brand-light/10 dark:via-navy dark:to-navy-hover/40 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white shadow-md shadow-brand/25">
              {companyInitials(profile) || "AC"}
            </div>
            <div className="min-w-0">
              <p className={ui.eyebrow}>Dealer account</p>
              <h2 className="truncate text-xl font-bold tracking-tight text-slate-950 dark:text-cream">
                {displayName}
              </h2>
              <p className={`mt-1 truncate ${ui.bodyMuted}`}>{profile.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.tier && (
              <span className="inline-flex rounded-full border border-brand/25 bg-brand-light/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand dark:bg-brand-light/10">
                {profile.tier.name} · {profile.tier.discountPercent}% off
              </span>
            )}
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                profileReadyForOrders
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200"
              }`}
            >
              {profileReadyForOrders ? "Ready to order" : "Profile incomplete"}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:border-zinc-700/50 dark:bg-navy dark:text-cream/80">
              {taxLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

type AccountSectionHeaderProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

export function AccountSectionHeader({ icon, title, description }: AccountSectionHeaderProps) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200/80 pb-5 dark:border-zinc-700/50">
      <div className="rounded-xl bg-brand-light/25 p-2.5 text-brand dark:bg-brand-light/10">
        {icon}
      </div>
      <div>
        <h2 className={ui.heading3}>{title}</h2>
        <p className={`mt-1.5 max-w-2xl ${ui.bodyMuted}`}>{description}</p>
      </div>
    </div>
  );
}

export function AccountAlert({
  tone,
  title,
  children,
}: {
  tone: "info" | "warning" | "success";
  title: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100"
        : "border-brand/25 bg-brand-light/25 text-slate-900 dark:border-brand/30 dark:bg-brand-light/10 dark:text-cream";

  const icon =
    tone === "success" ? (
      <CheckCircleIcon size={18} className="shrink-0 text-emerald-600 dark:text-emerald-300" />
    ) : (
      <UserIcon size={18} className="shrink-0 text-brand" />
    );

  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-4 sm:px-5 ${toneClass}`}>
      {icon}
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-sm leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
}
