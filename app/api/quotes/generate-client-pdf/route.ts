import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import {
  buildClientQuoteDownloadFilename,
} from "@/lib/client-quote-pdf";
import { resolveClientQuotePricing } from "@/lib/client-quote-pricing";
import { parseGenerateClientQuoteFormData } from "@/lib/client-quote-validation";
import {
  fetchClientQuoteBranding,
  insertClientQuoteRecord,
  saveClientQuotePdf,
  updateClientQuotePdfUrl,
  updateDealerQuoteBranding,
} from "@/lib/client-quotes";
import { getShippingAddressForUser } from "@/lib/shipping-addresses";
import { saveCompanyLogo } from "@/lib/save-company-logo";
import { databaseSetupHint } from "@/lib/db-setup-hints";
import { enforceMutationSecurity } from "@/lib/request-security";

export async function POST(request: Request) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  const userId = auth.user!.id;

  try {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const parsed = parseGenerateClientQuoteFormData(formData);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = parsed.data;

    const branding = await fetchClientQuoteBranding(userId);

    if (!branding) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let shippingPostalCode: string | null = null;

    if (payload.includeShipping) {
      const shippingAddress = await getShippingAddressForUser(
        userId,
        payload.shippingAddressId!
      );

      if (!shippingAddress) {
        return NextResponse.json(
          { error: "Selected shipping address was not found" },
          { status: 400 }
        );
      }

      shippingPostalCode = shippingAddress.zipCode;
    }

    const pricing = await resolveClientQuotePricing({
      items: payload.items,
      userId,
      userRole: auth.user!.role,
      markupPercentage: payload.markupPercentage,
      includeTax: payload.includeTax,
      includeShipping: payload.includeShipping,
      shippingPostalCode,
    });

    if ("error" in pricing) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status });
    }

    const companyLogoUrl = branding.companyLogoUrl;

    const footerText = payload.customFooterText ?? branding.customQuoteFooterText;

    if (
      payload.customFooterText !== null &&
      payload.customFooterText !== branding.customQuoteFooterText
    ) {
      await updateDealerQuoteBranding(userId, {
        customQuoteFooterText: payload.customFooterText,
      });
    }

    const record = await insertClientQuoteRecord({
      userId,
      clientName: payload.clientName,
      clientEmail: payload.clientEmail ?? null,
      pricing,
      pdfUrl: null,
      status: "PENDING",
    });

    if (!record) {
      return NextResponse.json(
        { error: "Failed to save client quote record" },
        { status: 500 }
      );
    }

    const { buildClientQuotePdfBuffer } = await import("@/lib/client-quote-pdf");
    const pdfBuffer = await buildClientQuotePdfBuffer({
      quoteId: record.id,
      clientName: payload.clientName,
      clientEmail: payload.clientEmail,
      createdAt: record.created_at,
      branding: {
        ...branding,
        companyLogoUrl,
      },
      pricing,
      customFooterText: footerText,
    });

    const finalPdfUrl = await saveClientQuotePdf(pdfBuffer);
    await updateClientQuotePdfUrl(record.id, finalPdfUrl);

    const filename = buildClientQuoteDownloadFilename(payload.clientName, record.id);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("POST /api/quotes/generate-client-pdf failed:", error);

    const hint = databaseSetupHint(error);
    const message =
      error instanceof Error && error.message
        ? `${error.message}${hint}`
        : `Failed to generate client quote.${hint}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
