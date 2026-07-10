import Stripe from "stripe";
import { roundCurrency } from "@/lib/pricing";

let stripeClient: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function amountToStripeCents(amount: number) {
  const normalized = roundCurrency(amount);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Stripe amount must be a positive server-calculated value");
  }

  return Math.round(normalized * 100);
}

export async function createPartialOrderRefund(params: {
  paymentIntentId: string;
  amount: number;
  orderId: number;
  adminUserId: number;
}) {
  const stripe = getStripeClient();
  const amountCents = amountToStripeCents(params.amount);

  return stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: amountCents,
    metadata: {
      orderId: String(params.orderId),
      adminUserId: String(params.adminUserId),
      reason: "order_modification_partial_refund",
    },
  });
}

export async function createOrderModificationCheckoutSession(params: {
  orderId: number;
  userId: number;
  amount: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripeClient();
  const amountCents = amountToStripeCents(params.amount);

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `Order #${params.orderId} modification balance`,
            description: "Additional payment required after admin order modification",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderId: String(params.orderId),
      userId: String(params.userId),
      purpose: "order_modification_payment",
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripeClient();

  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
}
