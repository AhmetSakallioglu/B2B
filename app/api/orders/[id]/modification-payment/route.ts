import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { finalizeOrderModificationPayment } from "@/lib/order-modification";
import {
  createOrderModificationCheckoutSession,
  isStripeConfigured,
} from "@/lib/stripe";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function resolveAppOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const orderId = Number.parseInt(id, 10);

  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const orderResult = await query<{
    status: string;
    modification_balance_due: string | null;
    modification_checkout_session_id: string | null;
    customer_email: string;
  }>(
    `
      SELECT
        o.status,
        o.modification_balance_due,
        o.modification_checkout_session_id,
        u.email AS customer_email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.id = $1
        AND o.user_id = $2
    `,
    [orderId, auth.user!.id]
  );

  if (orderResult.rows.length === 0) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = orderResult.rows[0];

  if (order.status !== "waiting_for_modification_payment") {
    return NextResponse.json(
      { error: "This order is not awaiting a modification payment" },
      { status: 409 }
    );
  }

  const balanceDue = Number.parseFloat(order.modification_balance_due ?? "0");

  if (!Number.isFinite(balanceDue) || balanceDue <= 0) {
    return NextResponse.json({ error: "Invalid modification balance" }, { status: 409 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Online payment is not configured. Contact support to complete this order update." },
      { status: 503 }
    );
  }

  const origin = resolveAppOrigin(request);
  const session = await createOrderModificationCheckoutSession({
    orderId,
    userId: auth.user!.id,
    amount: balanceDue,
    customerEmail: order.customer_email,
    successUrl: `${origin}/orders/${orderId}?modificationPaid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/orders/${orderId}?modificationCancelled=1`,
  });

  await query(
    `
      UPDATE orders
      SET modification_checkout_session_id = $1
      WHERE id = $2
    `,
    [session.id, orderId]
  );

  return NextResponse.json({
    checkoutUrl: session.url,
    balanceDue,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const orderId = Number.parseInt(id, 10);

  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const body = (await request.json()) as { sessionId?: string };
  const sessionId = body.sessionId?.trim();

  if (!sessionId) {
    return NextResponse.json({ error: "Missing checkout session id" }, { status: 400 });
  }

  try {
    const result = await finalizeOrderModificationPayment({
      orderId,
      userId: auth.user!.id,
      sessionId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    console.error("PATCH /api/orders/[id]/modification-payment failed:", error);
    return NextResponse.json({ error: "Failed to confirm modification payment" }, { status: 500 });
  }
}
