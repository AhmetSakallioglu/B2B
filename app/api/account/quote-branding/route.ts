import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import {
  fetchClientQuoteBranding,
  updateDealerQuoteBranding,
} from "@/lib/client-quotes";
import { parseQuoteBrandingFooterBody } from "@/lib/client-quote-validation";
import { saveCompanyLogo } from "@/lib/save-company-logo";
import { enforceMutationSecurity } from "@/lib/request-security";

export async function GET() {
  const auth = await requireCustomerSession();

  if (auth.response) {
    return auth.response;
  }

  try {
    const branding = await fetchClientQuoteBranding(auth.user!.id);

    if (!branding) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      branding: {
        companyName: branding.companyName,
        companyLogoUrl: branding.companyLogoUrl,
        customQuoteFooterText: branding.customQuoteFooterText,
        postalCode: branding.postalCode,
      },
    });
  } catch (error) {
    console.error("GET /api/account/quote-branding failed:", error);
    return NextResponse.json({ error: "Failed to load quote branding" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const updates: {
        companyLogoUrl?: string;
        customQuoteFooterText?: string | null;
      } = {};

      const logoFile = formData.get("companyLogo");

      if (logoFile instanceof File && logoFile.size > 0) {
        updates.companyLogoUrl = await saveCompanyLogo(logoFile);
      }

      if (formData.has("customQuoteFooterText")) {
        const raw = formData.get("customQuoteFooterText");
        updates.customQuoteFooterText =
          typeof raw === "string" && raw.trim()
            ? raw.trim().slice(0, 1000)
            : null;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: "Provide a logo file and/or footer text to update" },
          { status: 400 }
        );
      }

      await updateDealerQuoteBranding(userId, updates);

      const branding = await fetchClientQuoteBranding(userId);

      return NextResponse.json({
        branding: {
          companyName: branding?.companyName ?? "",
          companyLogoUrl: branding?.companyLogoUrl ?? null,
          customQuoteFooterText: branding?.customQuoteFooterText ?? null,
          postalCode: branding?.postalCode ?? "",
        },
      });
    }

    const footerText = parseQuoteBrandingFooterBody(await request.json());

    if (footerText === undefined) {
      return NextResponse.json({ error: "Invalid branding payload" }, { status: 400 });
    }

    await updateDealerQuoteBranding(userId, {
      customQuoteFooterText: footerText,
    });

    const branding = await fetchClientQuoteBranding(userId);

    return NextResponse.json({
      branding: {
        companyName: branding?.companyName ?? "",
        companyLogoUrl: branding?.companyLogoUrl ?? null,
        customQuoteFooterText: branding?.customQuoteFooterText ?? null,
        postalCode: branding?.postalCode ?? "",
      },
    });
  } catch (error) {
    console.error("PATCH /api/account/quote-branding failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update quote branding",
      },
      { status: 400 }
    );
  }
}
