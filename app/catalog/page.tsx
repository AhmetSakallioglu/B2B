"use client";

import Link from "next/link";
import { LoadingState } from "@/components/ui/LoadingState";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { finishToSlug } from "@/lib/catalog-browse";
import { ui } from "@/lib/ui-classes";
import type { DoorFinish } from "@/types/catalog";

function CatalogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const finishSlug = searchParams.get("finish") ?? "";

  const [selectedFinish, setSelectedFinish] = useState<DoorFinish | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!finishSlug) {
      router.replace("/");
      return;
    }

    fetch("/api/catalog/finishes")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load finishes");
        }

        const data = (await response.json()) as { finishes: DoorFinish[] };
        const finish =
          data.finishes.find((item) => item.slug === finishSlug) ??
          data.finishes.find((item) => finishToSlug(item.name) === finishSlug) ??
          null;

        if (!finish) {
          router.replace("/");
          return;
        }

        setSelectedFinish(finish);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load catalog");
      })
      .finally(() => setIsLoading(false));
  }, [finishSlug, router]);

  if (!finishSlug) {
    return null;
  }

  if (isLoading) {
    return <LoadingState fullScreen label="Loading catalog..." spinnerSize="lg" />;
  }

  if (error || !selectedFinish) {
    return (
      <div className={`flex min-h-full items-center justify-center px-4 ${ui.catalogPageBg}`}>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">
            {error ?? "Finish not found"}
          </p>
          <Link href="/" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
            Choose a finish
          </Link>
        </div>
      </div>
    );
  }

  return <CatalogBrowser selectedFinish={selectedFinish} />;
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={<LoadingState fullScreen label="Loading catalog..." spinnerSize="lg" />}
    >
      <CatalogPageContent />
    </Suspense>
  );
}
