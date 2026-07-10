export type EmailTemplateAutomationStage = 1 | 2 | 3;

export type EmailTemplateRecord = {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  is_system_default: boolean;
  automation_stage: EmailTemplateAutomationStage | null;
  is_active: boolean;
  automation_enabled: boolean;
  delay_hours: string | null;
  issue_promo_on_send: boolean;
  promo_discount_percent: string | null;
  promo_expiry_days: number | null;
  cta_label: string | null;
  cta_href: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type EmailTemplate = {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  isSystemDefault: boolean;
  automationStage: EmailTemplateAutomationStage | null;
  isActive: boolean;
  automationEnabled: boolean;
  delayHours: number | null;
  issuePromoOnSend: boolean;
  promoDiscountPercent: number | null;
  promoExpiryDays: number | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EmailTemplateInput = {
  name: string;
  subject: string;
  bodyHtml: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  automationEnabled?: boolean;
  automationStage?: EmailTemplateAutomationStage | null;
  delayHours?: number | null;
  issuePromoOnSend?: boolean;
  promoDiscountPercent?: number | null;
  promoExpiryDays?: number | null;
};

export type AbandonedCartEmailLogEntry = {
  id: number;
  userId: number;
  templateId: number | null;
  templateName: string;
  recipientEmail: string;
  subject: string;
  sendType: "automated" | "manual";
  sentBy: number | null;
  sentAt: string;
};

export const COUPON_EMAIL_TEMPLATE_VARIABLES = [
  "discount_code",
  "discount_percent",
  "discount_expiry",
  "discount_expiry_short",
] as const;

export type CouponEmailTemplateVariable = (typeof COUPON_EMAIL_TEMPLATE_VARIABLES)[number];

export const EMAIL_TEMPLATE_VARIABLES = [
  "customer_name",
  "dealer_company",
  "customer_email",
  "cart_items_table",
  "total_amount",
  "cart_url",
  "quotes_url",
  "offer_code",
  "offer_percent",
  "discount_code",
  "discount_percent",
  "discount_expiry",
  "discount_expiry_short",
  "company_name",
  "company_email",
  "company_phone",
] as const;

export type EmailTemplateVariable = (typeof EMAIL_TEMPLATE_VARIABLES)[number];

export const EMAIL_TEMPLATE_VARIABLE_HELP: Record<EmailTemplateVariable, string> = {
  customer_name: "Dealer contact or company name",
  dealer_company: "Dealer company name",
  customer_email: "Dealer email address",
  cart_items_table: "HTML table of abandoned cart items",
  total_amount: "Cart total amount",
  cart_url: "Link to the cart page",
  quotes_url: "Link to account quotes",
  offer_code: "Static offer code from abandoned cart settings",
  offer_percent: "Static offer discount from abandoned cart settings",
  discount_code: "Unique coupon code (requires Include personal coupon)",
  discount_percent: "Coupon discount percentage",
  discount_expiry: "Coupon expiry — full date (e.g. Tuesday, July 8, 2026)",
  discount_expiry_short: "Coupon expiry — short date (e.g. 7/8/2026, matches cart)",
  company_name: "Your company name",
  company_email: "Your company email",
  company_phone: "Your company phone",
};
