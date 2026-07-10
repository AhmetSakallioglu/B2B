import { NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { notifyAdminsPaymentConfirmed } from "@/lib/web-push/triggers";

export const runtime = "nodejs";

function resolveStripeEvent(request: Request, rawBody: string) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!signature || !webhookSecret) {
    return { error: "Webhook signature verification is not configured" as const };
  }

  const stripe = getStripeClient();

  try {
    return {
      event: stripe.webhooks.constructEvent(rawBody, signature, webhookSecret),
    };
  } catch (error) {
    console.error("[stripe-webhook:signature-failed]", error);
    return { error: "Invalid Stripe signature" as const };
  }
}

function parseOrderIdFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const raw = metadata?.orderId?.trim();

  if (!raw) {
    return null;
  }

  const orderId = Number.parseInt(raw, 10);
  return Number.isFinite(orderId) && orderId > 0 ? orderId : null;
}

async function resolveOrderTotal(orderId: number) {
  const result = await query<{ total_price: string }>(
    `SELECT total_price::text AS total_price FROM orders WHERE id = $1`,
    [orderId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const totalPrice = Number.parseFloat(result.rows[0].total_price);
  return Number.isFinite(totalPrice) ? totalPrice : null;
}

async function handlePaidOrderNotification(orderId: number, amountCents?: number | null) {
  const totalPrice = await resolveOrderTotal(orderId);

  if (totalPrice === null) {
    return;
  }

  const normalizedTotal =
    typeof amountCents === "number" && Number.isFinite(amountCents)
      ? amountCents / 100
      : totalPrice;

  notifyAdminsPaymentConfirmed({
    orderId,
    totalPrice: normalizedTotal,
  });
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const resolved = resolveStripeEvent(request, rawBody);

  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const { event } = resolved;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status !== "paid") {
          break;
        }

        const orderId = parseOrderIdFromMetadata(session.metadata);

        if (orderId) {
          await handlePaidOrderNotification(orderId, session.amount_total);
        }

        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = parseOrderIdFromMetadata(paymentIntent.metadata);

        if (orderId) {
          await handlePaidOrderNotification(orderId, paymentIntent.amount_received);
        }

        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("POST /api/webhooks/stripe failed:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
