import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { getClientQuoteForUser } from "@/lib/client-quotes";
import { isClientQuotePdfUrl } from "@/lib/client-quote-storage";
import { buildClientQuoteDownloadFilename } from "@/lib/client-quote-pdf";
import { databaseSetupHint } from "@/lib/db-setup-hints";
import { readStoredFile } from "@/lib/object-storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const quoteId = Number.parseInt(id, 10);

  if (!Number.isFinite(quoteId) || quoteId <= 0) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  try {
    const quote = await getClientQuoteForUser(quoteId, auth.user!.id);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (!isClientQuotePdfUrl(quote.pdfUrl)) {
      return NextResponse.json({ error: "PDF not available" }, { status: 404 });
    }

    const buffer = await readStoredFile(quote.pdfUrl);

    if (!buffer) {
      return NextResponse.json({ error: "PDF not available" }, { status: 404 });
    }
    const filename = buildClientQuoteDownloadFilename(quote.clientName, quote.id);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(`GET /api/client-quotes/${quoteId}/pdf failed:`, error);

    const hint = databaseSetupHint(error);
    const message =
      error instanceof Error && error.message
        ? `${error.message}${hint}`
        : `Failed to download client quote PDF.${hint}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
