import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { mapOrderRows, ORDER_LIST_QUERY } from "@/lib/orders";
import {
  attachPdfToQuickBooksEstimate,
  createQuickBooksEstimate,
  findOrCreateQuickBooksCustomer,
  mapOrderToQuickBooksLineItems,
} from "@/lib/quickbooks/estimate";
import { getQuickBooksConfig, isQuickBooksConfigured } from "@/lib/quickbooks/config";
import type { OrderRow } from "@/types/orders";

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_send_quickbooks");

  if (auth.response) {
    return auth.response;
  }

  const config = getQuickBooksConfig();

  if (!isQuickBooksConfigured(config)) {
    return NextResponse.json(
      {
        enabled: false,
        error:
          "QuickBooks integration is not enabled yet. Set QUICKBOOKS_ENABLED=true and complete OAuth setup.",
      },
      { status: 503 }
    );
  }

  let body: { orderId?: number; pdfBase64?: string };

  try {
    body = (await request.json()) as { orderId?: number; pdfBase64?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orderId = body.orderId;

  if (!orderId || Number.isNaN(orderId)) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  if (!body.pdfBase64) {
    return NextResponse.json(
      { error: "pdfBase64 attachment is required" },
      { status: 400 }
    );
  }

  const MAX_PDF_BASE64_LENGTH = 14 * 1024 * 1024;

  if (body.pdfBase64.length > MAX_PDF_BASE64_LENGTH) {
    return NextResponse.json({ error: "PDF attachment is too large" }, { status: 413 });
  }

  try {
    const result = await query<OrderRow>(
      `
        ${ORDER_LIST_QUERY}
        WHERE o.id = $1
        ORDER BY oi.id ASC
      `,
      [orderId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = mapOrderRows(result.rows, true)[0];
    const lineItems = mapOrderToQuickBooksLineItems(order);
    const pdfBuffer = Buffer.from(body.pdfBase64, "base64");

    const customerId = await findOrCreateQuickBooksCustomer(order.customer.email);
    const estimate = await createQuickBooksEstimate(order, pdfBuffer);
    const attachmentId = await attachPdfToQuickBooksEstimate(
      estimate.estimateId,
      pdfBuffer,
      `order-${order.id}-quote.pdf`
    );

    return NextResponse.json({
      enabled: true,
      estimateId: estimate.estimateId,
      customerId,
      attachmentId,
      lineItemCount: lineItems.length,
    });
  } catch (error) {
    console.error("POST /api/quickbooks/create-estimate failed:", error);

    return NextResponse.json(
      {
        enabled: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create QuickBooks estimate",
      },
      { status: 500 }
    );
  }
}
