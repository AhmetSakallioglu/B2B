import { getCompanyProfile } from "@/lib/company-profile";
import { formatPrice } from "@/lib/order-display";
import { absoluteAssetUrl, accountQuotesUrl, cartPageUrl } from "@/lib/app-url";
import { escapeHtml } from "@/lib/email/template-sanitizer";
import { formatPromoExpiryForEmail, formatPromoExpiryShort } from "@/lib/promo-display";
import type { AbandonedCartSettings } from "@/types/abandoned-cart";
import type { AbandonedCartDealerContext } from "@/types/abandoned-cart";
import type { EmailTemplate } from "@/types/email-template";
import type { PromoCode } from "@/types/promo-code";

const BRAND_NAVY = "#1c3a4a";
const BRAND_COPPER = "#b8611a";
const BRAND_CREAM = "#f5f0e6";

function greetingName(context: AbandonedCartDealerContext) {
  return context.contactName?.trim() || context.companyName?.trim() || "there";
}

export function renderCartItemsTableHtml(context: AbandonedCartDealerContext) {
  const rows = context.items
    .map((item) => {
      const image = absoluteAssetUrl(item.imageUrl);
      const imageCell = image
        ? `<img src="${escapeHtml(image)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;" />`
        : `<div style="width:56px;height:56px;border-radius:10px;background:#f1f5f9;border:1px solid #e2e8f0;"></div>`;

      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #eef2f7;width:68px;vertical-align:top;">${imageCell}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #eef2f7;vertical-align:top;">
          <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND_NAVY};">${escapeHtml(item.name)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Qty ${item.quantity}</p>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eef2f7;text-align:right;vertical-align:top;font-size:14px;font-weight:700;color:${BRAND_NAVY};">${formatPrice(item.lineTotal)}</td>
      </tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
    ${rows}
    <tr>
      <td colspan="2" style="padding-top:16px;font-size:14px;font-weight:700;color:${BRAND_NAVY};">Cart total</td>
      <td style="padding-top:16px;text-align:right;font-size:16px;font-weight:700;color:${BRAND_COPPER};">${formatPrice(context.cartTotal)}</td>
    </tr>
  </table>`;
}

function buildTemplateVariables(
  context: AbandonedCartDealerContext,
  settings: AbandonedCartSettings,
  issuedPromo: PromoCode | null
) {
  const company = getCompanyProfile();
  const discountCode = issuedPromo?.code ?? settings.offerCode;
  const discountPercent = issuedPromo?.discountValue ?? settings.offerPercent;
  const discountExpiry = issuedPromo
    ? formatPromoExpiryForEmail(issuedPromo.expiresAt)
    : "";
  const discountExpiryShort = issuedPromo
    ? formatPromoExpiryShort(issuedPromo.expiresAt)
    : "";

  return {
    customer_name: escapeHtml(greetingName(context)),
    dealer_company: escapeHtml(context.companyName ?? ""),
    customer_email: escapeHtml(context.email),
    cart_items_table: renderCartItemsTableHtml(context),
    total_amount: escapeHtml(formatPrice(context.cartTotal)),
    cart_url: cartPageUrl(),
    quotes_url: accountQuotesUrl(),
    offer_code: escapeHtml(settings.offerCode),
    offer_percent: escapeHtml(String(settings.offerPercent)),
    discount_code: escapeHtml(discountCode),
    discount_percent: escapeHtml(String(discountPercent)),
    discount_expiry: escapeHtml(discountExpiry),
    discount_expiry_short: escapeHtml(discountExpiryShort),
    company_name: escapeHtml(company.name || "Cabinet Co."),
    company_email: escapeHtml(company.email || ""),
    company_phone: escapeHtml(company.phone || ""),
  } as const;
}

export function replaceTemplateVariables(
  source: string,
  variables: ReturnType<typeof buildTemplateVariables>
) {
  return source.replace(/\{\{([a-z_]+)\}\}/g, (match, key: keyof typeof variables) => {
    const value = variables[key];

    if (value === undefined) {
      return match;
    }

    return value;
  });
}

function wrapEmailShell(params: {
  title: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
}) {
  const company = getCompanyProfile();

  const ctaBlock =
    params.ctaLabel && params.ctaHref
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 0;">
          <tr>
            <td style="border-radius:12px;background:${BRAND_COPPER};">
              <a href="${escapeHtml(params.ctaHref)}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(params.ctaLabel)}</a>
            </td>
          </tr>
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:${BRAND_NAVY};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND_NAVY};padding:28px 32px;">
              <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND_COPPER};font-weight:700;">${escapeHtml(company.name || "Cabinet Co.")}</p>
              <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;color:#ffffff;">${escapeHtml(params.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${params.bodyHtml}
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND_CREAM};padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                ${escapeHtml(company.name || "Cabinet Co.")}${company.tagline ? ` · ${escapeHtml(company.tagline)}` : ""}<br />
                ${company.email ? escapeHtml(company.email) : ""}${company.phone ? ` · ${escapeHtml(company.phone)}` : ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailFromTemplate(
  template: EmailTemplate,
  context: AbandonedCartDealerContext,
  settings: AbandonedCartSettings,
  issuedPromo: PromoCode | null = null
) {
  const variables = buildTemplateVariables(context, settings, issuedPromo);
  const subject = replaceTemplateVariables(template.subject, variables);
  const bodyHtml = replaceTemplateVariables(template.bodyHtml, variables);
  const ctaLabel = template.ctaLabel
    ? replaceTemplateVariables(template.ctaLabel, variables)
    : null;
  const ctaHref = template.ctaHref
    ? replaceTemplateVariables(template.ctaHref, variables)
    : null;

  return {
    subject,
    html: wrapEmailShell({
      title: subject,
      preheader: subject,
      bodyHtml,
      ctaLabel,
      ctaHref,
    }),
  };
}
