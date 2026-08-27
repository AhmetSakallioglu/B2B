import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { clearUserCart } from "@/lib/cart";
import { getCartAppliedPromo } from "@/lib/cart-applied-promo";
import { markAbandonedCartRecoveryCompleted } from "@/lib/abandoned-cart";
import { logImpersonatedOrderCreated } from "@/lib/impersonation-audit-log";
import { logCustomerOrderCreated } from "@/lib/order-audit-log";
import { parseCartLineItemsPayload } from "@/lib/cart-items";
import { pool, query } from "@/lib/db";
import {
  archiveMatchingQuotesForOrder,
  getQuoteAdminDiscountForUser,
  parseOptionalSourceQuoteId,
} from "@/lib/quotes";
import { mapOrderRows, ORDER_LIST_QUERY } from "@/lib/orders";
import { markPromoCodeUsed, normalizePromoCodeInput } from "@/lib/promo-codes";
import { resolveServerCartPricing } from "@/lib/server-cart-pricing";
import { rejectClientPricingTampering } from "@/lib/pricing-request-security";
import {
  isProfileCompleteForOrdering,
  mapUserProfileRow,
  ORDER_PROFILE_INCOMPLETE_MESSAGE,
  USER_PROFILE_SELECT,
} from "@/lib/user-profile";
import { resolveCheckoutShippingZip, getShippingAddressForUser } from "@/lib/shipping-addresses";
import { notifyAdminsNewOrderPlaced } from "@/lib/web-push/triggers";
import type { CheckoutShippingSelection } from "@/types/shipping-address";
import type { OrderRow } from "@/types/orders";
import type { UserProfileRow } from "@/types/account";

function parseOrderBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const items = parseCartLineItemsPayload(candidate.items);

  if (!items) {
    return null;
  }

  const promoCode =
    candidate.promoCode === undefined || candidate.promoCode === null
      ? null
      : normalizePromoCodeInput(candidate.promoCode);

  if (candidate.promoCode !== undefined && candidate.promoCode !== null && !promoCode) {
    return null;
  }

  const shippingPostalCode =
    typeof candidate.shippingPostalCode === "string"
      ? candidate.shippingPostalCode.trim()
      : null;

  const shippingAddressId =
    typeof candidate.shippingAddressId === "string"
      ? candidate.shippingAddressId.trim()
      : null;

  const sourceQuoteId = parseOptionalSourceQuoteId(candidate.sourceQuoteId);

  let shipping: CheckoutShippingSelection | null = null;

  if (candidate.shipping && typeof candidate.shipping === "object") {
    const selection = candidate.shipping as Record<string, unknown>;

    if (selection.type === "billing") {
      shipping = { type: "billing" };
    } else if (selection.type === "saved" && typeof selection.addressId === "string") {
      shipping = { type: "saved", addressId: selection.addressId };
    } else if (selection.type === "new" && selection.address && typeof selection.address === "object") {
      const address = selection.address as Record<string, unknown>;

      if (
        typeof address.addressTitle === "string" &&
        typeof address.streetAddress === "string" &&
        typeof address.city === "string" &&
        typeof address.zipCode === "string"
      ) {
        shipping = {
          type: "new",
          saveForFuture: selection.saveForFuture === true,
          address: {
            addressTitle: address.addressTitle,
            streetAddress: address.streetAddress,
            city: address.city,
            state: typeof address.state === "string" ? address.state : "TX",
            zipCode: address.zipCode,
            contactPerson:
              typeof address.contactPerson === "string" ? address.contactPerson : null,
            contactPhone:
              typeof address.contactPhone === "string" ? address.contactPhone : null,
          },
        };
      }
    }
  }

  return { items, promoCode, shippingPostalCode, shippingAddressId, shipping, sourceQuoteId };
}

export async function GET() {
  const auth = await requireSession();

  if (auth.response) {
    return auth.response;
  }

  try {
    const result = await query<OrderRow>(
      `
        ${ORDER_LIST_QUERY}
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC, oi.id ASC
      `,
      [auth.user!.id]
    );

    return NextResponse.json({
      orders: mapOrderRows(result.rows),
    });
  } catch (error) {
    console.error("GET /api/orders failed:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  if (auth.user!.role === "admin" && !auth.user!.impersonatedBy) {
    return NextResponse.json(
      { error: "Admin accounts cannot place orders" },
      { status: 403 }
    );
  }

  const placedByAdminId = auth.user!.impersonatedBy ?? null;

  const client = await pool.connect();

  try {
    const rawBody = await request.json();
    const tamper = rejectClientPricingTampering(rawBody);

    if (tamper) {
      return NextResponse.json({ error: tamper.error }, { status: tamper.status });
    }

    const body = parseOrderBody(rawBody);

    if (!body) {
      return NextResponse.json({ error: "Invalid order payload" }, { status: 400 });
    }

    if (body.promoCode) {
      const appliedPromo = await getCartAppliedPromo(auth.user!.id);

      if (
        !appliedPromo ||
        appliedPromo.code.toUpperCase() !== body.promoCode.toUpperCase()
      ) {
        return NextResponse.json(
          { error: "Apply the promo code to your cart before placing the order" },
          { status: 400 }
        );
      }
    }

    const profileResult = await query<UserProfileRow>(
      `
        SELECT ${USER_PROFILE_SELECT}
        FROM users
        WHERE id = $1
      `,
      [auth.user!.id]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const profile = mapUserProfileRow(profileResult.rows[0]);

    if (!isProfileCompleteForOrdering(profile)) {
      return NextResponse.json(
        { error: ORDER_PROFILE_INCOMPLETE_MESSAGE },
        { status: 400 }
      );
    }

    let deliveryPostalCode = body.shippingPostalCode || profile.postalCode;
    let shippingAddressId = body.shippingAddressId;

    if (body.shipping) {
      try {
        const resolved = await resolveCheckoutShippingZip({
          userId: auth.user!.id,
          profile,
          selection: body.shipping,
        });
        deliveryPostalCode = resolved.zipCode;
        shippingAddressId = resolved.shippingAddressId ?? shippingAddressId;
      } catch (shippingError) {
        return NextResponse.json(
          {
            error:
              shippingError instanceof Error
                ? shippingError.message
                : "Invalid shipping address selection",
          },
          { status: 400 }
        );
      }
    }

    if (shippingAddressId) {
      const ownedAddress = await getShippingAddressForUser(auth.user!.id, shippingAddressId);

      if (!ownedAddress) {
        return NextResponse.json(
          { error: "Invalid or unauthorized shipping address ID" },
          { status: 400 }
        );
      }

      deliveryPostalCode = ownedAddress.zipCode;
    }

    const quoteDiscountPercent = body.sourceQuoteId
      ? await getQuoteAdminDiscountForUser(body.sourceQuoteId, auth.user!.id)
      : 0;

    const pricing = await resolveServerCartPricing({
      items: body.items,
      userId: auth.user!.id,
      userRole: auth.user!.role,
      promoCode: body.promoCode,
      postalCode: deliveryPostalCode,
      extraDiscountPercent: quoteDiscountPercent,
    });

    if ("error" in pricing) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status });
    }

    if (!body.shipping && !body.shippingPostalCode) {
      return NextResponse.json(
        { error: "Select a shipping address before placing your order" },
        { status: 400 }
      );
    }

    const {
      items: pricedItems,
      msrpSubtotal,
      subtotal,
      tierName,
      tierDiscountPercent,
      tierDiscountAmount,
      promoDiscount,
      taxableSubtotal,
      taxRate,
      taxAmount,
      shippingAmount,
      shippingZoneId,
      shippingZoneName,
      shippingPostalCode,
      totalAmount,
      promoCodeId,
      promoCode,
    } = pricing;

    await client.query("BEGIN");

    const orderResult = await client.query<{ id: number; status: string; created_at: string }>(
      `
        INSERT INTO orders (
          user_id,
          total_price,
          status,
          placed_by_admin_id,
          subtotal,
          promo_discount,
          promo_code_id,
          msrp_subtotal,
          tier_name,
          tier_discount_percent,
          tier_discount_amount,
          tax_rate,
          tax_amount,
          shipping_amount,
          shipping_zone_id,
          shipping_zone_name,
          shipping_postal_code,
          shipping_address_id
        )
        VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id, status, created_at
      `,
      [
        auth.user!.id,
        totalAmount,
        placedByAdminId,
        subtotal,
        promoDiscount,
        promoCodeId ?? null,
        msrpSubtotal,
        tierName,
        tierDiscountPercent,
        tierDiscountAmount,
        taxRate,
        taxAmount,
        shippingAmount,
        shippingZoneId,
        shippingZoneName,
        shippingPostalCode,
        shippingAddressId,
      ]
    );

    const order = orderResult.rows[0];

    for (const item of pricedItems) {
      await client.query(
        `
          INSERT INTO order_items (order_id, variant_id, quantity, price)
          VALUES ($1, $2, $3, $4)
        `,
        [order.id, Number.parseInt(item.id, 10), item.quantity, item.price]
      );
    }

    if (promoCodeId && promoCode) {
      await markPromoCodeUsed(
        {
          promoCodeId,
          userId: auth.user!.id,
          orderId: order.id,
          code: promoCode,
          promoDiscount,
        },
        client
      );
    }

    await client.query("COMMIT");
    await clearUserCart(auth.user!.id);
    await markAbandonedCartRecoveryCompleted(auth.user!.id);

    try {
      await archiveMatchingQuotesForOrder({
        userId: auth.user!.id,
        items: pricedItems.map((item) => ({ id: item.id, quantity: item.quantity })),
        sourceQuoteId: body.sourceQuoteId,
      });
    } catch (archiveError) {
      console.error("Failed to archive quotes after order:", archiveError);
    }

    if (placedByAdminId) {
      await logImpersonatedOrderCreated({
        adminId: placedByAdminId,
        customerUserId: auth.user!.id,
        orderId: order.id,
      });
    } else {
      await logCustomerOrderCreated({
        userId: auth.user!.id,
        orderId: order.id,
        totalPrice: totalAmount,
      });
    }

    notifyAdminsNewOrderPlaced({
      orderId: order.id,
      totalPrice: totalAmount,
    });

    return NextResponse.json(
      {
        orderId: order.id,
        status: order.status,
        createdAt: order.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("POST /api/orders failed:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  } finally {
    client.release();
  }
}
