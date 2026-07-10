import type { ClientQuoteStoredItem } from "@/lib/client-quote-storage";

export type ClientQuoteStatus = "PENDING" | "CONVERTED" | "EXPIRED";

export type ClientQuoteLineItem = {
  variantId: string;
  productSku: string;
  variantSku: string;
  color: string;
  width: string;
  height: string;
  depth: string;
  quantity: number;
  dealerNetUnitPrice: number;
  clientUnitPrice: number;
  lineTotal: number;
};

export type ClientQuotePricingResult = {
  items: ClientQuoteLineItem[];
  dealerNetSubtotal: number;
  clientSubtotal: number;
  markupPercentage: number;
  taxRate: number;
  taxAmount: number;
  shippingAmount: number;
  shippingIsFree: boolean;
  shippingNotice: string | null;
  totalAmount: number;
  includeTax: boolean;
  includeShipping: boolean;
};

export type ClientQuoteBranding = {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  companyLogoUrl: string | null;
  customQuoteFooterText: string | null;
};

export type GenerateClientQuoteRequest = {
  clientName: string;
  clientEmail?: string | null;
  markupPercentage: number;
  includeTax: boolean;
  includeShipping: boolean;
  shippingAddressId?: string | null;
  customFooterText?: string | null;
  items: import("@/lib/cart-items").CartLineInput[];
};

export type ClientQuoteSummary = {
  id: number;
  clientName: string;
  clientEmail: string | null;
  totalAmount: number;
  status: ClientQuoteStatus;
  pdfUrl: string | null;
  createdAt: string;
  itemCount: number;
};

export type ClientQuoteDetail = ClientQuoteSummary & {
  items: ClientQuoteStoredItem[];
  markupPercentage: number;
  includeTax: boolean;
  includeShipping: boolean;
  clientSubtotal: number;
  taxAmount: number;
  shippingAmount: number;
};

export type AdminClientQuoteSummary = ClientQuoteSummary & {
  userId: number;
  dealerCompanyName: string | null;
  dealerContactName: string | null;
  dealerEmail: string;
};

export type ClientQuoteRow = {
  id: number;
  user_id: number;
  client_name: string;
  client_email: string | null;
  markup_percentage: string;
  include_tax: boolean;
  include_shipping: boolean;
  items: unknown;
  msrp_subtotal: string;
  client_subtotal: string;
  tax_amount: string;
  shipping_amount: string;
  total_amount: string;
  pdf_url: string | null;
  status: ClientQuoteStatus;
  created_at: string;
};

export const CLIENT_QUOTE_STATUS_LABELS: Record<ClientQuoteStatus, string> = {
  PENDING: "Pending",
  CONVERTED: "Converted",
  EXPIRED: "Expired",
};
