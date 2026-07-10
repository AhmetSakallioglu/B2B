export type PromoDiscountType = "percentage" | "fixed";

export type PromoCreationType = "AUTOMATIC" | "MANUAL";

export type PromoCodeRecord = {
  id: string;
  code: string;
  discount_type: PromoDiscountType;
  discount_value: string;
  user_id: number;
  creation_type: PromoCreationType;
  is_used: boolean;
  is_active: boolean;
  expires_at: Date;
  used_at: Date | null;
  order_id: number | null;
  created_at: Date;
};

export type PromoCode = {
  id: string;
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  userId: number;
  creationType: PromoCreationType;
  isUsed: boolean;
  isActive: boolean;
  expiresAt: string;
  usedAt: string | null;
  orderId: number | null;
  createdAt: string;
};

export type AppliedPromoSummary = {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  subtotal: number;
  promoDiscount: number;
  taxableSubtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  expiresAt: string;
};

export const PROMO_CODE_INVALID_MESSAGE = "Invalid or unauthorized coupon code";

export const PROMO_DEFAULT_DISCOUNT_PERCENT = 5;
export const PROMO_DEFAULT_EXPIRY_DAYS = 7;
