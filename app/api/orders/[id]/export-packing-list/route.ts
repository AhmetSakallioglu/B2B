import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  buildOrderPackingListDownloadFilename,
} from "@/lib/order-packing-list-pdf";
import { fetchOrderPackingListData } from "@/lib/order-packing-list";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSession();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const orderId = Number.parseInt(id, 10);

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  try {
    const packingList = await fetchOrderPackingListData(orderId, auth.user!);

    if (!packingList) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (packingList.items.length === 0) {
      return NextResponse.json({ error: "Order has no line items" }, { status: 400 });
    }

    const { buildOrderPackingListPdfBuffer } = await import("@/lib/order-packing-list-pdf");
    const pdfBuffer = await buildOrderPackingListPdfBuffer(packingList);
    const filename = buildOrderPackingListDownloadFilename(orderId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(`GET /api/orders/${orderId}/export-packing-list failed:`, error);
    return NextResponse.json({ error: "Failed to generate packing list PDF" }, { status: 500 });
  }
}
