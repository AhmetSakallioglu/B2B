import type { OrderStatus } from "@/lib/order-status";

export type AdminDashboardOverview = {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  completedOrders: number;
  ordersThisMonth: number;
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLast30Days: number;
  customerCount: number;
  pendingUserCount: number;
  productCount: number;
  variantCount: number;
  activeFinishCount: number;
  outOfStockCount: number;
  potentialPipelineRevenue: number;
  openQuoteCount: number;
};

export type AdminDashboardTopQuoteGenerator = {
  userId: number;
  contactName: string;
  companyName: string;
  email: string;
  totalQuotes: number;
  totalPotentialRevenue: number;
};

export type AdminDashboardRecentOrder = {
  id: number;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
  customerCompany: string;
  customerEmail: string;
  itemCount: number;
};

export type AdminDashboardTopProduct = {
  productName: string;
  productSku: string;
  finishName: string;
  unitsSold: number;
  revenue: number;
};

export type AdminDashboardRevenueDay = {
  date: string;
  orderCount: number;
  revenue: number;
};

export type AdminDashboardData = {
  overview: AdminDashboardOverview;
  recentOrders: AdminDashboardRecentOrder[];
  topProducts: AdminDashboardTopProduct[];
  revenueTrend: AdminDashboardRevenueDay[];
  topQuoteGenerators: AdminDashboardTopQuoteGenerator[];
};

export type AdminDashboardStats = {
  startDate: string;
  endDate: string;
  revenue: {
    total: number;
    orderCount: number;
  };
  topProducts: Array<{
    productSku: string;
    productName: string;
    unitsSold: number;
  }>;
  topFinishes: Array<{
    finishName: string;
    unitsSold: number;
  }>;
  topUsers: Array<{
    userId: number;
    companyName: string;
    email: string;
    totalSpent: number;
    orderCount: number;
  }>;
  revenueTrend: AdminDashboardRevenueDay[];
  quotePipeline: {
    potentialPipelineRevenue: number;
    openQuoteCount: number;
  };
  topQuoteGenerators: AdminDashboardTopQuoteGenerator[];
};
