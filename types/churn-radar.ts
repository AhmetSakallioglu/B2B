export type AtRiskDealerRiskReason = "inactive_login" | "inactive_orders";

export type AtRiskDealer = {
  userId: number;
  companyName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  lifetimeValue: number;
  completedOrderCount: number;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  daysSinceLogin: number | null;
  daysSinceActivity: number | null;
  riskReasons: AtRiskDealerRiskReason[];
};

export type ChurnRadarResponse = {
  cachedAt: string;
  ltvThreshold: number;
  dealers: AtRiskDealer[];
};
