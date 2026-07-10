"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  buildAdminDateRangeQuery,
  getDefaultAdminDateRange,
  resolveAdminDateRangeFromParams,
} from "@/lib/admin-date-range";
import type { DashboardDateRange } from "@/lib/admin-dashboard-stats";

function AdminDashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateRange = resolveAdminDateRangeFromParams(
    searchParams,
    getDefaultAdminDateRange()
  );

  const handleDateRangeChange = (nextRange: DashboardDateRange | null) => {
    if (!nextRange) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    const query = buildAdminDateRangeQuery(nextRange);
    const nextParams = new URLSearchParams(query);

    for (const [key, value] of nextParams.entries()) {
      params.set(key, value);
    }

    router.replace(`/admin?${params.toString()}`);
  };

  return (
    <AdminShell
      wide
      title="Command Center"
      subtitle="Business snapshot, sales radar, and urgent actions"
    >
      <AdminDashboard dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
    </AdminShell>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<LoadingState fullScreen label="Loading dashboard..." spinnerSize="lg" />}>
      <AdminDashboardPageContent />
    </Suspense>
  );
}
