"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { ProductCatalogImage } from "@/components/catalog/ProductCatalogImage";
import { CatalogSiteHeader } from "@/components/catalog/CatalogSiteHeader";
import { SearchIcon } from "@/components/ui/Icon";
import { ui } from "@/lib/ui-classes";
import { readJsonResponse } from "@/lib/fetch-json";
import type { DoorFinish } from "@/types/catalog";

export function DoorFinishPickerPage() {
  const [finishes, setFinishes] = useState<DoorFinish[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalog/finishes")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load door finishes");
        }

        const data = await readJsonResponse<{ finishes: DoorFinish[] }>(response);
        setFinishes(data.finishes);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load door finishes"
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredFinishes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return finishes;
    }

    return finishes.filter(
      (finish) =>
        finish.name.toLowerCase().includes(query) ||
        finish.slug.toLowerCase().includes(query)
    );
  }, [finishes, searchQuery]);

  return (
    <div className={ui.catalogPageBg}>
      <CatalogSiteHeader subtitle="Select Door / Finish" />

      <main className="mx-auto max-w-[1600px] px-4 py-8 xl:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h1 className={`${ui.heading1} text-balance`}>Choose your door style</h1>
            <p className={`mt-2 ${ui.bodyMuted}`}>
              Pick a finish to browse cabinets available in that color.
            </p>
          </div>

          {!isLoading && !error && finishes.length > 0 && (
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search finishes..."
                className={`${ui.input} py-2.5 pl-10`}
                aria-label="Search door finishes"
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="mt-8 space-y-6">
            <LoadingState label="Loading door finishes..." minHeight="min-h-24" />
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-64 animate-pulse rounded-2xl border border-slate-200/60 bg-white dark:border-zinc-700/50 dark:bg-navy"
                />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : filteredFinishes.length === 0 ? (
          <div className={`mt-8 px-6 py-12 text-center ${ui.emptyState}`}>
            <p className="text-lg font-semibold text-slate-900 dark:text-cream">
              {finishes.length === 0
                ? "No door finishes available yet"
                : "No finishes match your search"}
            </p>
            <p className={`mt-2 ${ui.bodyMuted}`}>
              {finishes.length === 0
                ? "Products will appear here once finishes and cabinets are added in admin."
                : "Try a different name or clear the search."}
            </p>
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={`mt-5 ${ui.btnSecondary}`}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {filteredFinishes.map((finish) => (
              <Link
                key={finish.slug}
                href={`/catalog?finish=${finish.slug}`}
                className={`group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md ${ui.catalogProductCard}`}
              >
                <div className="relative aspect-4/3 overflow-hidden bg-slate-100 dark:bg-navy-hover">
                  <ProductCatalogImage
                    src={finish.sampleImage}
                    alt={finish.name}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/55 via-transparent to-transparent opacity-80 transition group-hover:opacity-100" />
                  <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                    {finish.variantCount} cabinets
                  </span>
                </div>

                <div className="flex flex-1 flex-col px-3 pt-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-cream">
                    {finish.name}
                  </h3>
                </div>

                <div className="border-t border-slate-100 px-3 pb-3 pt-2.5 dark:border-zinc-800/80">
                  <span
                    className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 shadow-sm transition duration-200 group-hover:border-brand group-hover:bg-brand group-hover:text-white group-hover:shadow-md group-hover:shadow-brand/15 dark:border-zinc-600 dark:bg-navy-hover dark:text-cream/90 dark:group-hover:border-brand dark:group-hover:bg-brand dark:group-hover:text-white"
                    aria-hidden
                  >
                    Select finish
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
