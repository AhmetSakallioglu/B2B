export const HOT_LEAD_MIN_QUOTES = 5;

export type QuoteCustomerAnalyticsRow = {
  user_id: number;
  contact_name: string | null;
  company_name: string | null;
  email: string;
  phone: string | null;
  total_quotes: string;
  total_potential_revenue: string;
  last_activity_at: string;
  order_count: string;
};

export type QuoteCustomerAnalytics = {
  userId: number;
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  totalQuotes: number;
  totalPotentialRevenue: number;
  lastActivityAt: string;
  orderCount: number;
  isHotLead: boolean;
};

export type QuotePipelineSummary = {
  potentialPipelineRevenue: number;
  openQuoteCount: number;
};

export type TopQuoteGenerator = {
  userId: number;
  contactName: string;
  companyName: string;
  email: string;
  totalQuotes: number;
  totalPotentialRevenue: number;
};
