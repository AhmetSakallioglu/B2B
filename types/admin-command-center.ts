export type CommandCenterKpi = {
  monthlyRevenue: number;
  monthlyRevenueChangePercent: number | null;
  pendingApprovals: number;
  pendingDealerApplications: number;
  pendingTaxExemptions: number;
  recoverableHotCartRevenue: number;
  hotCartCount: number;
  activeDealersThisMonth: number;
};

export type CommandCenterTrendMonth = {
  monthKey: string;
  monthLabel: string;
  completedOrderRevenue: number;
  completedOrderCount: number;
  clientQuoteRevenue: number;
  clientQuoteCount: number;
};

export type CommandCenterActivityTone = "brand" | "emerald" | "amber" | "rose" | "slate";

export type CommandCenterActivity = {
  id: string;
  message: string;
  timestamp: string;
  tone: CommandCenterActivityTone;
};

export type CommandCenterAbandonedCart = {
  userId: number;
  companyName: string;
  contactName: string | null;
  phone: string | null;
  email: string;
  cartTotal: number;
  itemCount: number;
  lastActiveAt: string;
  temperature: "HOT" | "WARM" | "COLD";
};

export type CommandCenterPendingTax = {
  userId: number;
  companyName: string | null;
  contactName: string | null;
  email: string;
  submittedAt: string;
  certificateUrl: string | null;
};

export type AdminCommandCenterData = {
  kpis: CommandCenterKpi;
  salesTrend: CommandCenterTrendMonth[];
  recentActivity: CommandCenterActivity[];
  topAbandonedCarts: CommandCenterAbandonedCart[];
  pendingTaxExemptions: CommandCenterPendingTax[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
};
