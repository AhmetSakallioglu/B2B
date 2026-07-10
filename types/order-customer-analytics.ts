import type { OrderStatus } from "@/lib/order-status";

export type OrderCustomerSummaryRow = {
  user_id: number;
  contact_name: string | null;
  company_name: string | null;
  email: string;
  phone: string | null;
  total_orders: string;
  lifetime_value: string;
  pending_count: string;
  processing_count: string;
  confirmed_count: string;
  shipped_count: string;
  completed_count: string;
  cancelled_count: string;
  waiting_for_modification_payment_count: string;
};

export type OrderStatusBreakdown = Record<OrderStatus, number>;

export type OrderCustomerSummary = {
  userId: number;
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  totalOrders: number;
  lifetimeValue: number;
  averageOrderValue: number;
  statusBreakdown: OrderStatusBreakdown;
};
