import { loadAdminDashboardExtendedData } from "@/lib/admin-dashboard-extended";
import { loadAtRiskDealers } from "@/lib/churn-radar";
import type { DashboardDateRange } from "@/lib/admin-dashboard-stats";

/** Admin dashboard reads should stay fresh; churn radar may be cached briefly. */
export async function getCachedDashboardExtendedData(range: DashboardDateRange) {
  return loadAdminDashboardExtendedData(range);
}

export { loadAtRiskDealers as getCachedChurnRadarData };
