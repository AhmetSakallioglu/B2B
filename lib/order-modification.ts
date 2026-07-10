import type { PoolClient } from "pg";
import { pool, query } from "@/lib/db";
import {
  buildCartSnapshotFromLines,
  calculateModifiedOrderTotals,
  lookupVariantBySku,
  priceNewModificationLine,
  resolveDealerTaxStatusForModification,
  type ResolvedModificationLine,
} from "@/lib/order-modification-pricing";
import { isEditableOrderStatus, type OrderStatus } from "@/lib/order-status";
import { logOrderModifiedByAdmin } from "@/lib/security-audit";
import {
  createOrderModificationCheckoutSession,
  createPartialOrderRefund,
  isStripeConfigured,
  retrieveCheckoutSession,
} from "@/lib/stripe";
import type {
  OrderCartSnapshotItem,
  OrderModificationResult,
  PendingOrderModification,
} from "@/types/order-modification";
import type { OrderModificationLineInput } from "@/types/order-modification";

type ExistingOrderRow = {
  id: number;
  user_id: number;
  status: OrderStatus;
  total_price: string;
  subtotal: string | null;
  promo_discount: string | null;
  msrp_subtotal: string | null;
  tier_name: string | null;
  tier_discount_percent: string | null;
  tier_discount_amount: string | null;
  tax_rate: string | null;
  tax_amount: string | null;
  shipping_amount: string | null;
  stripe_payment_intent_id: string | null;
  customer_email: string;
};

type ExistingOrderItemRow = {
  id: number;
  variant_id: number;
  quantity: number;
  price: string;
  variant_sku: string;
  product_sku: string;
  product_name: string;
  color: string;
};

function toNumber(value: string | null | undefined, fallback = 0) {
  if (value == null) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildExistingCartSnapshot(items: ExistingOrderItemRow[]): OrderCartSnapshotItem[] {
  return items.map((item) => ({
    itemId: item.id,
    variantId: item.variant_id,
    variantSku: item.variant_sku,
    productSku: item.product_sku,
    productName: item.product_name,
    color: item.color,
    quantity: item.quantity,
    unitPrice: Number.parseFloat(item.price),
  }));
}

type ResolveModificationResult =
  | { error: string; status: 400 | 404 }
  | { lines: ResolvedModificationLine[] };

async function resolveModificationLines(params: {
  dealerUserId: number;
  existingItems: ExistingOrderItemRow[];
  modifications: OrderModificationLineInput[];
}): Promise<ResolveModificationResult> {
  const itemById = new Map(params.existingItems.map((item) => [item.id, item]));
  const working = new Map<number, ResolvedModificationLine>();

  for (const existing of params.existingItems) {
    working.set(existing.variant_id, {
      variantId: existing.variant_id,
      quantity: existing.quantity,
      unitPrice: Number.parseFloat(existing.price),
      variantSku: existing.variant_sku,
      productSku: existing.product_sku,
      productName: existing.product_name,
      color: existing.color,
    });
  }

  for (const modification of params.modifications) {
    if (modification.itemId) {
      const existing = itemById.get(modification.itemId);

      if (!existing) {
        return { error: "One or more order line items were not found", status: 400 as const };
      }

      if (modification.quantity <= 0) {
        working.delete(existing.variant_id);
        continue;
      }

      working.set(existing.variant_id, {
        variantId: existing.variant_id,
        quantity: modification.quantity,
        unitPrice: Number.parseFloat(existing.price),
        variantSku: existing.variant_sku,
        productSku: existing.product_sku,
        productName: existing.product_name,
        color: existing.color,
      });
      continue;
    }

    if (!modification.variantSku) {
      return { error: "Invalid modification line", status: 400 as const };
    }

    const variant = await lookupVariantBySku(modification.variantSku);

    if (!variant) {
      return {
        error: `Cabinet code not found: ${modification.variantSku}`,
        status: 404 as const,
      };
    }

    const priced = await priceNewModificationLine({
      variantId: variant.variant_id,
      quantity: modification.quantity,
      dealerUserId: params.dealerUserId,
    });

    if (!priced) {
      return { error: "Unable to price cabinet code", status: 400 as const };
    }

    const current = working.get(priced.variantId);

    if (current) {
      working.set(priced.variantId, {
        ...priced,
        quantity: current.quantity + priced.quantity,
        unitPrice: current.unitPrice,
      });
    } else {
      working.set(priced.variantId, priced);
    }
  }

  const lines = [...working.values()];

  if (lines.length === 0) {
    return { error: "Order must contain at least one line item", status: 400 as const };
  }

  return { lines };
}

async function applyOrderModificationToDatabase(
  client: PoolClient,
  params: {
    orderId: number;
    lines: ResolvedModificationLine[];
    pricing: ReturnType<typeof calculateModifiedOrderTotals> & {
      msrpSubtotal: number;
      tierName: string;
      tierDiscountPercent: number;
      tierDiscountAmount: number;
    };
    status: OrderStatus;
    modificationBalanceDue?: number | null;
    modificationCheckoutSessionId?: string | null;
    pendingModification?: PendingOrderModification | null;
    preModificationStatus?: OrderStatus | null;
    stripePaymentIntentId?: string | null;
  }
) {
  await client.query(`DELETE FROM order_items WHERE order_id = $1`, [params.orderId]);

  for (const line of params.lines) {
    await client.query(
      `
        INSERT INTO order_items (order_id, variant_id, quantity, price)
        VALUES ($1, $2, $3, $4)
      `,
      [params.orderId, line.variantId, line.quantity, line.unitPrice]
    );
  }

  await client.query(
    `
      UPDATE orders
      SET
        total_price = $1,
        subtotal = $2,
        promo_discount = $3,
        msrp_subtotal = $4,
        tier_name = $5,
        tier_discount_percent = $6,
        tier_discount_amount = $7,
        tax_rate = $8,
        tax_amount = $9,
        shipping_amount = $10,
        status = $11,
        modification_balance_due = $12,
        modification_checkout_session_id = $13,
        pending_modification = $14,
        pre_modification_status = $15,
        stripe_payment_intent_id = COALESCE($16, stripe_payment_intent_id)
      WHERE id = $17
    `,
    [
      params.pricing.totalAmount,
      params.pricing.subtotal,
      params.pricing.promoDiscount,
      params.pricing.msrpSubtotal,
      params.pricing.tierName,
      params.pricing.tierDiscountPercent,
      params.pricing.tierDiscountAmount,
      params.pricing.taxRate,
      params.pricing.taxAmount,
      params.pricing.shippingAmount,
      params.status,
      params.modificationBalanceDue ?? null,
      params.modificationCheckoutSessionId ?? null,
      params.pendingModification ? JSON.stringify(params.pendingModification) : null,
      params.preModificationStatus ?? null,
      params.stripePaymentIntentId ?? null,
      params.orderId,
    ]
  );
}

export async function applySecureOrderModification(params: {
  orderId: number;
  adminUserId: number;
  modifications: OrderModificationLineInput[];
  appOrigin: string;
}): Promise<
  | { ok: true; result: OrderModificationResult }
  | { ok: false; error: string; status: number }
> {
  const orderResult = await query<ExistingOrderRow>(
    `
      SELECT
        o.id,
        o.user_id,
        o.status,
        o.total_price,
        o.subtotal,
        o.promo_discount,
        o.msrp_subtotal,
        o.tier_name,
        o.tier_discount_percent,
        o.tier_discount_amount,
        o.tax_rate,
        o.tax_amount,
        o.shipping_amount,
        o.stripe_payment_intent_id,
        u.email AS customer_email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.id = $1
    `,
    [params.orderId]
  );

  if (orderResult.rows.length === 0) {
    return { ok: false, error: "Order not found", status: 404 };
  }

  const order = orderResult.rows[0];

  if (!isEditableOrderStatus(order.status)) {
    return {
      ok: false,
      error: "This order status does not allow line-item edits",
      status: 409,
    };
  }

  const itemsResult = await query<ExistingOrderItemRow>(
    `
      SELECT
        oi.id,
        oi.variant_id,
        oi.quantity,
        oi.price,
        cp.variant_sku,
        cp.product_sku,
        cp.product_name,
        cp.color
      FROM order_items oi
      JOIN catalog_products cp ON cp.variant_id = oi.variant_id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
    `,
    [params.orderId]
  );

  const oldCart = buildExistingCartSnapshot(itemsResult.rows);
  const resolved = await resolveModificationLines({
    dealerUserId: order.user_id,
    existingItems: itemsResult.rows,
    modifications: params.modifications,
  });

  if (!("lines" in resolved)) {
    return { ok: false, error: resolved.error, status: resolved.status };
  }

  const { lines } = resolved;

  const taxStatus = await resolveDealerTaxStatusForModification(order.user_id);
  const promoDiscount = toNumber(order.promo_discount);
  const shippingAmount = toNumber(order.shipping_amount);
  const pricingTotals = calculateModifiedOrderTotals({
    lines,
    promoDiscount,
    shippingAmount,
    taxStatus,
  });

  const msrpSubtotal = roundMsrp(lines);
  const tierDiscountAmount = Math.max(0, msrpSubtotal - pricingTotals.subtotal);

  const pricing = {
    ...pricingTotals,
    msrpSubtotal,
    tierName: order.tier_name ?? "Standard",
    tierDiscountPercent: toNumber(order.tier_discount_percent),
    tierDiscountAmount,
  };

  const oldTotalAmount = toNumber(order.total_price);
  const balanceDelta = roundCurrency(pricing.totalAmount - oldTotalAmount);
  const existingItemIds = new Map(
    itemsResult.rows.map((item) => [item.variant_id, item.id])
  );
  const newCart = buildCartSnapshotFromLines(lines, existingItemIds);

  if (Math.abs(balanceDelta) < 0.01) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await applyOrderModificationToDatabase(client, {
        orderId: params.orderId,
        lines,
        pricing,
        status: order.status,
        pendingModification: null,
        modificationBalanceDue: null,
        modificationCheckoutSessionId: null,
        preModificationStatus: null,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await logOrderModifiedByAdmin({
      adminUserId: params.adminUserId,
      orderId: params.orderId,
      oldCart,
      newCart,
    });

    return {
      ok: true,
      result: {
        outcome: "applied",
        orderId: params.orderId,
        oldTotalAmount,
        newTotalAmount: pricing.totalAmount,
        balanceDelta: 0,
      },
    };
  }

  if (balanceDelta < 0) {
    const refundAmount = roundCurrency(Math.abs(balanceDelta));

    if (isStripeConfigured() && order.stripe_payment_intent_id) {
      await createPartialOrderRefund({
        paymentIntentId: order.stripe_payment_intent_id,
        amount: refundAmount,
        orderId: params.orderId,
        adminUserId: params.adminUserId,
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await applyOrderModificationToDatabase(client, {
        orderId: params.orderId,
        lines,
        pricing,
        status: order.status,
        pendingModification: null,
        modificationBalanceDue: null,
        modificationCheckoutSessionId: null,
        preModificationStatus: null,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await logOrderModifiedByAdmin({
      adminUserId: params.adminUserId,
      orderId: params.orderId,
      oldCart,
      newCart,
    });

    return {
      ok: true,
      result: {
        outcome: "refunded",
        orderId: params.orderId,
        oldTotalAmount,
        newTotalAmount: pricing.totalAmount,
        balanceDelta,
        refundAmount,
      },
    };
  }

  if (balanceDelta > 0) {
    const pendingModification: PendingOrderModification = {
      items: lines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      pricing: {
        subtotal: pricing.subtotal,
        promoDiscount: pricing.promoDiscount,
        msrpSubtotal: pricing.msrpSubtotal,
        tierName: pricing.tierName,
        tierDiscountPercent: pricing.tierDiscountPercent,
        tierDiscountAmount: pricing.tierDiscountAmount,
        taxRate: pricing.taxRate,
        taxAmount: pricing.taxAmount,
        shippingAmount: pricing.shippingAmount,
        totalAmount: pricing.totalAmount,
      },
      oldTotalAmount,
      balanceDue: balanceDelta,
      oldCart,
      newCart,
    };

    let checkoutUrl: string | null = null;
    let checkoutSessionId: string | null = null;

    if (isStripeConfigured()) {
      const session = await createOrderModificationCheckoutSession({
        orderId: params.orderId,
        userId: order.user_id,
        amount: balanceDelta,
        customerEmail: order.customer_email,
        successUrl: `${params.appOrigin}/orders/${params.orderId}?modificationPaid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${params.appOrigin}/orders/${params.orderId}?modificationCancelled=1`,
      });

      checkoutUrl = session.url;
      checkoutSessionId = session.id;
    }

    await query(
      `
        UPDATE orders
        SET
          status = 'waiting_for_modification_payment',
          modification_balance_due = $1,
          modification_checkout_session_id = $2,
          pending_modification = $3,
          pre_modification_status = $4
        WHERE id = $5
      `,
      [
        balanceDelta,
        checkoutSessionId,
        JSON.stringify(pendingModification),
        order.status,
        params.orderId,
      ]
    );

    await logOrderModifiedByAdmin({
      adminUserId: params.adminUserId,
      orderId: params.orderId,
      oldCart,
      newCart,
    });

    return {
      ok: true,
      result: {
        outcome: "awaiting_payment",
        orderId: params.orderId,
        oldTotalAmount,
        newTotalAmount: pricing.totalAmount,
        balanceDelta,
        checkoutUrl: checkoutUrl ?? undefined,
      },
    };
  }

  return {
    ok: false,
    error: "Unable to process order modification",
    status: 500,
  };
}

function roundMsrp(lines: ResolvedModificationLine[]) {
  return lines.reduce((sum, line) => {
    const listEstimate = line.unitPrice;
    return sum + listEstimate * line.quantity;
  }, 0);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export async function finalizeOrderModificationPayment(params: {
  orderId: number;
  userId: number;
  sessionId: string;
}) {
  const orderResult = await query<{
    id: number;
    user_id: number;
    status: OrderStatus;
    modification_checkout_session_id: string | null;
    pending_modification: PendingOrderModification | null;
    pre_modification_status: OrderStatus | null;
  }>(
    `
      SELECT
        id,
        user_id,
        status,
        modification_checkout_session_id,
        pending_modification,
        pre_modification_status
      FROM orders
      WHERE id = $1
        AND user_id = $2
    `,
    [params.orderId, params.userId]
  );

  if (orderResult.rows.length === 0) {
    return { ok: false as const, error: "Order not found", status: 404 };
  }

  const order = orderResult.rows[0];

  if (order.status !== "waiting_for_modification_payment") {
    return { ok: false as const, error: "Order is not awaiting modification payment", status: 409 };
  }

  if (
    order.modification_checkout_session_id &&
    order.modification_checkout_session_id !== params.sessionId
  ) {
    return { ok: false as const, error: "Invalid checkout session", status: 400 };
  }

  if (isStripeConfigured()) {
    const session = await retrieveCheckoutSession(params.sessionId);

    if (session.payment_status !== "paid") {
      return { ok: false as const, error: "Payment not completed", status: 402 };
    }
  }

  const pending = order.pending_modification;

  if (!pending) {
    return { ok: false as const, error: "Pending modification not found", status: 409 };
  }

  const restoreStatus = order.pre_modification_status ?? "processing";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [params.orderId]);

    for (const line of pending.items) {
      await client.query(
        `
          INSERT INTO order_items (order_id, variant_id, quantity, price)
          VALUES ($1, $2, $3, $4)
        `,
        [params.orderId, line.variantId, line.quantity, line.unitPrice]
      );
    }

    await client.query(
      `
        UPDATE orders
        SET
          total_price = $1,
          subtotal = $2,
          promo_discount = $3,
          msrp_subtotal = $4,
          tier_name = $5,
          tier_discount_percent = $6,
          tier_discount_amount = $7,
          tax_rate = $8,
          tax_amount = $9,
          shipping_amount = $10,
          status = $11,
          modification_balance_due = NULL,
          modification_checkout_session_id = NULL,
          pending_modification = NULL,
          pre_modification_status = NULL
        WHERE id = $12
      `,
      [
        pending.pricing.totalAmount,
        pending.pricing.subtotal,
        pending.pricing.promoDiscount,
        pending.pricing.msrpSubtotal,
        pending.pricing.tierName,
        pending.pricing.tierDiscountPercent,
        pending.pricing.tierDiscountAmount,
        pending.pricing.taxRate,
        pending.pricing.taxAmount,
        pending.pricing.shippingAmount,
        restoreStatus,
        params.orderId,
      ]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { ok: true as const, status: restoreStatus };
}
