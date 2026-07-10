export type DashboardSystemAlerts = {
  pendingDealerApplications: number;
  pendingFulfillmentOrders: number;
};

export type TopPerformingFinish = {
  finishId: number;
  finishName: string;
  sampleImageUrl: string | null;
  unitsSold: number;
  revenue: number;
};

export type TopMovingCabinet = {
  cabinetCode: string;
  productName: string;
  unitsSold: number;
};

export type TopSpendingDealer = {
  userId: number;
  companyName: string;
  email: string;
  orderCount: number;
  lifetimeValue: number;
};

export type AdminDashboardExtendedData = {
  cachedAt?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  alerts: DashboardSystemAlerts;
  topFinishes: TopPerformingFinish[];
  topCabinets: TopMovingCabinet[];
  topDealers: TopSpendingDealer[];
};
