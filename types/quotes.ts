import type { QuoteStatus } from "@/lib/quote-validation";
import type { CheckoutLineItem } from "@/types/checkout";
import type { OrderCartItem } from "@/types/catalog";

export type QuoteSaveRequest = {
  quoteName: string;
  items: CheckoutLineItem[];
};

export type QuoteRow = {
  id: number;
  user_id: number;
  quote_name: string;
  items: OrderCartItem[];
  total_amount: string;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
};

export type QuoteSummary = {
  id: number;
  quoteName: string;
  totalAmount: number;
  status: QuoteStatus;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type QuoteDetail = QuoteSummary & {
  items: OrderCartItem[];
  userId: number;
};

export type AdminQuoteSummary = QuoteSummary & {
  userId: number;
  customerEmail: string;
  companyName: string;
  contactName: string;
};

export type AdminQuoteDetail = QuoteDetail & {
  customerEmail: string;
  companyName: string;
  contactName: string;
};

export type QuotePriceChangedItem = {
  variantId: string;
  oldPrice: number;
  newPrice: number | null;
  outOfStock?: boolean;
};

export type QuotePriceFreshness = {
  priceChanged: boolean;
  oldTotalAmount: number;
  newTotalAmount: number;
  changedItems: QuotePriceChangedItem[];
  updatedItems: OrderCartItem[];
};

export type QuoteDetailResponse = {
  quote: QuoteDetail;
  price_changed?: boolean;
  old_total_amount?: number;
  new_total_amount?: number;
  changed_items?: QuotePriceChangedItem[];
};
