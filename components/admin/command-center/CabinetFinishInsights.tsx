import Link from "next/link";
import { ProductCatalogImage } from "@/components/catalog/ProductCatalogImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { AdminDashboardExtendedData } from "@/types/admin-dashboard-extended";

function finishFallbackColor(name: string) {
  let hash = 0;

  for (const char of name) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 35% 62%)`;
}

function FinishSwatch({
  name,
  sampleImageUrl,
}: {
  name: string;
  sampleImageUrl: string | null;
}) {
  if (sampleImageUrl) {
    return (
      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-slate-200/80 shadow-sm dark:border-zinc-600">
        <ProductCatalogImage
          src={sampleImageUrl}
          alt=""
          sizes="28px"
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className="h-7 w-7 shrink-0 rounded-full border border-slate-200/80 shadow-sm dark:border-zinc-600"
      style={{ backgroundColor: finishFallbackColor(name) }}
      aria-hidden
    />
  );
}

type CabinetFinishInsightsProps = {
  data: AdminDashboardExtendedData;
  dateRangeLabel: string;
};

export function CabinetFinishInsights({ data, dateRangeLabel }: CabinetFinishInsightsProps) {
  const { topFinishes, topCabinets, topDealers } = data;

  return (
    <section className="space-y-4">
      <div>
        <h2 className={ui.heading3}>Cabinet &amp; Finish Insights</h2>
        <p className={`mt-1 ${ui.bodyMuted}`}>
          Sector leaders for {dateRangeLabel}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className={`p-5 ${ui.adminCard}`}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">
            Top Performing Finishes
          </h3>
          <p className={`mt-1 text-xs ${ui.bodyMuted}`}>By order revenue in selected period</p>
          {topFinishes.length === 0 ? (
            <p className={`mt-5 text-sm ${ui.bodyMuted}`}>No finish sales in this period.</p>
          ) : (
            <ol className="mt-5 space-y-3">
              {topFinishes.map((finish, index) => (
                <li
                  key={finish.finishId}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-zinc-700/50 dark:bg-navy-hover/30"
                >
                  <span className="w-4 shrink-0 text-xs font-bold text-slate-400">{index + 1}.</span>
                  <FinishSwatch name={finish.finishName} sampleImageUrl={finish.sampleImageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-cream">
                      {finish.finishName}
                    </p>
                    <p className={`text-xs ${ui.bodyMuted}`}>
                      {finish.unitsSold} units · {formatPrice(finish.revenue)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className={`p-5 ${ui.adminCard}`}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">
            Top Moving Cabinets
          </h3>
          <p className={`mt-1 text-xs ${ui.bodyMuted}`}>By units sold in selected period</p>
          {topCabinets.length === 0 ? (
            <p className={`mt-5 text-sm ${ui.bodyMuted}`}>No cabinet movement in this period.</p>
          ) : (
            <ol className="mt-5 space-y-2.5">
              {topCabinets.map((cabinet, index) => (
                <li
                  key={cabinet.cabinetCode}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-zinc-700/50 dark:bg-navy-hover/30"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-cream">
                      <span className="text-slate-400">{index + 1}.</span> {cabinet.cabinetCode}
                    </p>
                    <p className={`truncate text-xs ${ui.bodyMuted}`}>{cabinet.productName}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-brand">
                    {cabinet.unitsSold.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className={`p-5 ${ui.adminCard}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">
                Top Spending Dealers
              </h3>
              <p className={`mt-1 text-xs ${ui.bodyMuted}`}>By order value in selected period</p>
            </div>
            <Link
              href="/admin/orders?tab=customers"
              className="text-xs font-medium text-brand underline-offset-2 hover:underline"
            >
              View all
            </Link>
          </div>
          {topDealers.length === 0 ? (
            <p className={`mt-5 text-sm ${ui.bodyMuted}`}>No dealer orders in this period.</p>
          ) : (
            <ol className="mt-5 space-y-3">
              {topDealers.map((dealer, index) => (
                <li
                  key={dealer.userId}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-zinc-700/50 dark:bg-navy-hover/30"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-cream">
                    <span className="text-slate-400">{index + 1}.</span> {dealer.companyName}
                  </p>
                  <p className={`mt-0.5 text-xs ${ui.bodyMuted}`}>
                    {formatPrice(dealer.lifetimeValue)} · {dealer.orderCount} order
                    {dealer.orderCount === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  );
}

export function CabinetFinishInsightsSkeleton() {
  return (
    <section className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={`min-h-[280px] space-y-3 p-5 ${ui.adminCard}`}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-32" />
            {Array.from({ length: 3 }).map((__, row) => (
              <Skeleton key={row} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
