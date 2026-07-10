import { buildOrderPricingSummary } from "@/lib/order-pricing-summary";
import type { OrderCustomer, OrderRow, OrderWithCustomer } from "@/types/orders";

function mapOrderCustomer(row: OrderRow): OrderCustomer {
  return {
    id: row.user_id,
    email: row.customer_email,
    companyName: row.customer_company_name ?? "",
    contactName: row.customer_contact_name ?? "",
    phone: row.customer_phone ?? "",
    federalTaxId: row.customer_federal_tax_id ?? "",
    addressLine1: row.customer_address_line1 ?? "",
    addressLine2: row.customer_address_line2 ?? "",
    city: row.customer_city ?? "",
    state: row.customer_state ?? "",
    postalCode: row.customer_postal_code ?? "",
    country: row.customer_country ?? "",
  };
}

function parseNullableNumber(value: string | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type OrderAccumulator = OrderWithCustomer & {
  _pricingSource: {
    subtotal: number | null;
    promoDiscount: number;
    msrpSubtotalSnapshot: number | null;
    tierNameSnapshot: string | null;
    tierDiscountPercentSnapshot: number | null;
    tierDiscountAmountSnapshot: number | null;
    taxRateSnapshot: number | null;
    taxAmountSnapshot: number | null;
    shippingAmountSnapshot: number | null;
    shippingZoneNameSnapshot: string | null;
    shippingPostalCodeSnapshot: string | null;
    promoCode: string | null;
    promoDiscountValue: number | null;
    promoDiscountType: string | null;
    tierNameFallback: string | null;
    tierDiscountPercentFallback: number | null;
  };
};

export function mapOrderRows(rows: OrderRow[], includeCustomer: true): OrderWithCustomer[];
export function mapOrderRows(
  rows: OrderRow[],
  includeCustomer?: false
): Omit<OrderWithCustomer, "customer">[];
export function mapOrderRows(rows: OrderRow[], includeCustomer = false) {
  const ordersMap = new Map<number, OrderAccumulator>();

  for (const row of rows) {
    if (!ordersMap.has(row.order_id)) {
      const balanceDue = parseNullableNumber(row.modification_balance_due);
      const pendingTotal =
        row.pending_modification?.pricing?.totalAmount ?? null;

      ordersMap.set(row.order_id, {
        id: row.order_id,
        status: row.status,
        totalPrice: Number.parseFloat(row.total_price),
        createdAt: row.created_at,
        customer: mapOrderCustomer(row),
        items: [],
        ...(row.status === "waiting_for_modification_payment" && balanceDue
          ? {
              modificationPayment: {
                balanceDue,
                pendingTotalAmount:
                  typeof pendingTotal === "number" ? pendingTotal : null,
              },
            }
          : {}),
        pricing: {
          msrpSubtotal: 0,
          tierName: "Standard",
          tierDiscountPercent: 0,
          tierDiscountAmount: 0,
          appliedCouponCode: null,
          couponDiscountPercent: null,
          couponDiscountAmount: 0,
          taxableSubtotal: 0,
          taxRate: 0,
          taxAmount: 0,
          shippingAmount: 0,
          shippingZoneName: null,
          shippingIsFree: false,
          shippingIsOutOfZone: false,
          shippingNotice: null,
          shippingPostalCode: null,
          totalAmount: Number.parseFloat(row.total_price),
        },
        _pricingSource: {
          subtotal: parseNullableNumber(row.order_subtotal),
          promoDiscount: Number.parseFloat(row.order_promo_discount ?? "0"),
          msrpSubtotalSnapshot: parseNullableNumber(row.order_msrp_subtotal),
          tierNameSnapshot: row.order_tier_name,
          tierDiscountPercentSnapshot: parseNullableNumber(row.order_tier_discount_percent),
          tierDiscountAmountSnapshot: parseNullableNumber(row.order_tier_discount_amount),
          taxRateSnapshot: parseNullableNumber(row.order_tax_rate),
          taxAmountSnapshot: parseNullableNumber(row.order_tax_amount),
          shippingAmountSnapshot: parseNullableNumber(row.order_shipping_amount),
          shippingZoneNameSnapshot: row.order_shipping_zone_name,
          shippingPostalCodeSnapshot: row.order_shipping_postal_code,
          promoCode: row.promo_code,
          promoDiscountValue: parseNullableNumber(row.promo_discount_value),
          promoDiscountType: row.promo_discount_type,
          tierNameFallback: row.tier_name,
          tierDiscountPercentFallback: parseNullableNumber(row.tier_discount_percent),
        },
      });
    }

    if (row.item_id && row.variant_id) {
      ordersMap.get(row.order_id)?.items.push({
        id: row.item_id,
        variantId: row.variant_id,
        quantity: row.quantity ?? 0,
        unitPrice: Number.parseFloat(row.unit_price ?? "0"),
        listUnitPrice: parseNullableNumber(row.list_unit_price),
        variantSku: row.variant_sku ?? "",
        productSku: row.product_sku ?? "",
        productName: row.product_name ?? "",
        color: row.color ?? "",
        widthIn: Number.parseFloat(row.width_in ?? "0"),
        heightIn: Number.parseFloat(row.height_in ?? "0"),
        depthIn: Number.parseFloat(row.depth_in ?? "0"),
        imageUrl: row.product_image_url ?? null,
      });
    }
  }

  const orders = Array.from(ordersMap.values()).map(({ _pricingSource, ...order }) => ({
    ...order,
    pricing: buildOrderPricingSummary({
      items: order.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        listUnitPrice: item.listUnitPrice,
      })),
      subtotal: _pricingSource.subtotal,
      promoDiscount: _pricingSource.promoDiscount,
      totalPrice: order.totalPrice,
      msrpSubtotalSnapshot: _pricingSource.msrpSubtotalSnapshot,
      tierNameSnapshot: _pricingSource.tierNameSnapshot,
      tierDiscountPercentSnapshot: _pricingSource.tierDiscountPercentSnapshot,
      tierDiscountAmountSnapshot: _pricingSource.tierDiscountAmountSnapshot,
      taxRateSnapshot: _pricingSource.taxRateSnapshot,
      taxAmountSnapshot: _pricingSource.taxAmountSnapshot,
      shippingAmountSnapshot: _pricingSource.shippingAmountSnapshot,
      shippingZoneNameSnapshot: _pricingSource.shippingZoneNameSnapshot,
      shippingPostalCodeSnapshot: _pricingSource.shippingPostalCodeSnapshot,
      promoCode: _pricingSource.promoCode,
      promoDiscountValue: _pricingSource.promoDiscountValue,
      promoDiscountType: _pricingSource.promoDiscountType,
      tierNameFallback: _pricingSource.tierNameFallback,
      tierDiscountPercentFallback: _pricingSource.tierDiscountPercentFallback,
    }),
  }));

  if (includeCustomer) {
    return orders;
  }

  return orders.map(({ id, status, totalPrice, createdAt, items, pricing, modificationPayment }) => ({
    id,
    status,
    totalPrice,
    createdAt,
    items,
    pricing,
    ...(modificationPayment ? { modificationPayment } : {}),
  }));
}

export const ORDER_LIST_QUERY = `
  SELECT
    o.id AS order_id,
    o.status,
    o.total_price,
    o.subtotal AS order_subtotal,
    o.promo_discount AS order_promo_discount,
    o.msrp_subtotal AS order_msrp_subtotal,
    o.tier_name AS order_tier_name,
    o.tier_discount_percent AS order_tier_discount_percent,
    o.tier_discount_amount AS order_tier_discount_amount,
    o.tax_rate AS order_tax_rate,
    o.tax_amount AS order_tax_amount,
    o.shipping_amount AS order_shipping_amount,
    o.shipping_zone_name AS order_shipping_zone_name,
    o.shipping_postal_code AS order_shipping_postal_code,
    o.modification_balance_due,
    o.pending_modification,
    o.created_at,
    pc.code AS promo_code,
    pc.discount_type AS promo_discount_type,
    pc.discount_value AS promo_discount_value,
    u.id AS user_id,
    u.email AS customer_email,
    u.company_name AS customer_company_name,
    u.contact_name AS customer_contact_name,
    u.phone AS customer_phone,
    u.federal_tax_id AS customer_federal_tax_id,
    u.address_line1 AS customer_address_line1,
    u.address_line2 AS customer_address_line2,
    u.city AS customer_city,
    u.state AS customer_state,
    u.postal_code AS customer_postal_code,
    u.country AS customer_country,
    ct.name AS tier_name,
    ct.discount_percent AS tier_discount_percent,
    oi.id AS item_id,
    oi.variant_id,
    oi.quantity,
    oi.price AS unit_price,
    pv.price AS list_unit_price,
    pv.sku AS variant_sku,
    p.sku AS product_sku,
    p.name AS product_name,
    df.name AS color,
    pv.width_in,
    pv.height_in,
    pv.depth_in,
    p.image_url AS product_image_url
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN customer_tiers ct ON ct.id = u.tier_id
  LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN product_variants pv ON pv.id = oi.variant_id
  LEFT JOIN door_finishes df ON df.id = pv.finish_id
  LEFT JOIN products p ON p.id = pv.product_id
`;
