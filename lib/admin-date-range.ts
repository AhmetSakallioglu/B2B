import type { DashboardDateRange } from "@/lib/admin-dashboard-stats";

export type AdminDateRangePreset = "last7" | "last30" | "last90" | "custom";

export const ADMIN_DATE_RANGE_PRESETS: Array<{
  id: AdminDateRangePreset;
  label: string;
  days: number;
}> = [
  { id: "last7", label: "Last 7 days", days: 7 },
  { id: "last30", label: "Last 30 days", days: 30 },
  { id: "last90", label: "Last 90 days", days: 90 },
];

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getDefaultAdminDateRange(): DashboardDateRange {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

export function buildAdminDateRangeFromPreset(preset: AdminDateRangePreset): DashboardDateRange {
  if (preset === "custom") {
    return getDefaultAdminDateRange();
  }

  const match = ADMIN_DATE_RANGE_PRESETS.find((entry) => entry.id === preset);

  if (!match) {
    return getDefaultAdminDateRange();
  }

  const end = new Date();
  const start = new Date(end.getTime() - (match.days - 1) * 24 * 60 * 60 * 1000);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

export function resolveAdminDateRangeFromParams(
  searchParams: URLSearchParams,
  fallback?: DashboardDateRange
): DashboardDateRange {
  const startDate = searchParams.get("startDate")?.trim();
  const endDate = searchParams.get("endDate")?.trim();

  if (!startDate || !endDate) {
    return fallback ?? getDefaultAdminDateRange();
  }

  return { startDate, endDate };
}

export function buildAdminDateRangeQuery(range: DashboardDateRange) {
  const params = new URLSearchParams();
  params.set("startDate", range.startDate);
  params.set("endDate", range.endDate);
  return params.toString();
}

export function toDashboardTimestamps(range: DashboardDateRange) {
  return {
    rangeStart: `${range.startDate}T00:00:00.000Z`,
    rangeEnd: `${range.endDate}T23:59:59.999Z`,
  };
}

export function detectDateRangePreset(range: DashboardDateRange): AdminDateRangePreset {
  for (const preset of ADMIN_DATE_RANGE_PRESETS) {
    const built = buildAdminDateRangeFromPreset(preset.id);

    if (built.startDate === range.startDate && built.endDate === range.endDate) {
      return preset.id;
    }
  }

  return "custom";
}

export function formatAdminDateRangeLabel(range: DashboardDateRange) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(new Date(`${range.startDate}T12:00:00.000Z`))} – ${formatter.format(
    new Date(`${range.endDate}T12:00:00.000Z`)
  )}`;
}
