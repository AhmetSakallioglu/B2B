import type { OrderStatus } from "@/lib/order-status";

export type OrderItem = {
  id: number;
  variantId: number;
  quantity: number;
  unitPrice: number;
  listUnitPrice: number | null;
  variantSku: string;
  productSku: string;
  productName: string;
  color: string;
  widthIn: number;
  heightIn: number;
  depthIn: number;
  imageUrl: string | null;
};

export type OrderPricingSummary = {
  msrpSubtotal: number;
  tierName: string;
  tierDiscountPercent: number;
  tierDiscountAmount: number;
  appliedCouponCode: string | null;
  couponDiscountPercent: number | null;
  couponDiscountAmount: number;
  taxableSubtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingAmount: number;
  shippingZoneName: string | null;
  shippingIsFree: boolean;
  shippingIsOutOfZone: boolean;
  shippingNotice: string | null;
  shippingPostalCode: string | null;
  totalAmount: number;
};

export type Order = {
  id: number;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
  items: OrderItem[];
  pricing: OrderPricingSummary;
  modificationPayment?: {
    balanceDue: number;
    pendingTotalAmount: number | null;
  };
};

export type OrderCustomer = {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
  phone: string;
  federalTaxId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type OrderWithCustomer = Order & {
  customer: OrderCustomer;
};

export type OrderRow = {
  order_id: number;
  status: OrderStatus;
  total_price: string;
  order_subtotal: string | null;
  order_promo_discount: string | null;
  order_msrp_subtotal: string | null;
  order_tier_name: string | null;
  order_tier_discount_percent: string | null;
  order_tier_discount_amount: string | null;
  order_tax_rate: string | null;
  order_tax_amount: string | null;
  order_shipping_amount: string | null;
  order_shipping_zone_name: string | null;
  order_shipping_postal_code: string | null;
  modification_balance_due: string | null;
  pending_modification: { pricing?: { totalAmount?: number } } | null;
  promo_code: string | null;
  promo_discount_type: string | null;
  promo_discount_value: string | null;
  tier_name: string | null;
  tier_discount_percent: string | null;
  created_at: string;
  user_id: number;
  customer_email: string;
  customer_company_name: string | null;
  customer_contact_name: string | null;
  customer_phone: string | null;
  customer_federal_tax_id: string | null;
  customer_address_line1: string | null;
  customer_address_line2: string | null;
  customer_city: string | null;
  customer_state: string | null;
  customer_postal_code: string | null;
  customer_country: string | null;
  item_id: number | null;
  variant_id: number | null;
  quantity: number | null;
  unit_price: string | null;
  list_unit_price: string | null;
  variant_sku: string | null;
  product_sku: string | null;
  product_name: string | null;
  color: string | null;
  width_in: string | null;
  height_in: string | null;
  depth_in: string | null;
  product_image_url: string | null;
};
