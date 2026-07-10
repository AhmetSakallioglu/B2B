import { getCompanyProfile } from "@/lib/company-profile";
import { formatPrice } from "@/lib/order-display";
import { absoluteAssetUrl, accountQuotesUrl, cartPageUrl } from "@/lib/app-url";
import type { AbandonedCartDealerContext } from "@/types/abandoned-cart";

const BRAND_NAVY = "#1c3a4a";
const BRAND_COPPER = "#b8611a";
const BRAND_CREAM = "#f5f0e6";

function greetingName(context: AbandonedCartDealerContext) {
  return context.contactName?.trim() || context.companyName?.trim() || "there";
}

function emailShell(params: {
  preheader: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
  footerNote?: string;
}) {
  const company = getCompanyProfile();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:${BRAND_NAVY};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${params.preheader}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND_NAVY};padding:28px 32px;">
              <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND_COPPER};font-weight:700;">${company.name || "Cabinet Co."}</p>
              <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;color:#ffffff;">${params.title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${params.bodyHtml}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 0;">
                <tr>
                  <td style="border-radius:12px;background:${BRAND_COPPER};">
                    <a href="${params.ctaHref}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${params.ctaLabel}</a>
                  </td>
                </tr>
              </table>
              ${
                params.footerNote
                  ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${params.footerNote}</p>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND_CREAM};padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                ${company.name}${company.tagline ? ` · ${company.tagline}` : ""}<br />
                ${company.email ? `${company.email}` : ""}${company.phone ? ` · ${company.phone}` : ""}
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

function renderCartItemsTable(context: AbandonedCartDealerContext) {
  const rows = context.items
    .map((item) => {
      const image = absoluteAssetUrl(item.imageUrl);
      const imageCell = image
        ? `<img src="${image}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;" />`
        : `<div style="width:56px;height:56px;border-radius:10px;background:#f1f5f9;border:1px solid #e2e8f0;"></div>`;

      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #eef2f7;width:68px;vertical-align:top;">${imageCell}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #eef2f7;vertical-align:top;">
          <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND_NAVY};">${item.name}</p>
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

export function buildAbandonedCartReminderEmail(context: AbandonedCartDealerContext) {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Hi ${greetingName(context)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">You left a cabinet project in your cart. Your selections are saved and ready whenever you want to finish checkout.</p>
    ${renderCartItemsTable(context)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#64748b;">Need to adjust quantities or add another run? You can update everything from your cart before placing the order.</p>
  `;

  return {
    subject: "Complete Your Cabinet Project",
    html: emailShell({
      preheader: "Your saved cabinet selections are waiting in your cart.",
      title: "Complete Your Cabinet Project",
      bodyHtml,
      ctaLabel: "Go to Cart",
      ctaHref: cartPageUrl(),
    }),
  };
}

export function buildAbandonedCartSupportEmail(context: AbandonedCartDealerContext) {
  const company = getCompanyProfile();

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Hi ${greetingName(context)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">We noticed your cabinet project is still open. If you need help with layout, finish selection, or sizing, our team can walk through the project with you.</p>
    <div style="margin:20px 0;padding:18px 20px;border-radius:14px;background:${BRAND_CREAM};border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND_NAVY};">Design &amp; project support</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">
        Email us at <a href="mailto:${company.email}" style="color:${BRAND_COPPER};font-weight:700;text-decoration:none;">${company.email || "our support team"}</a>
        ${company.phone ? ` or call <strong>${company.phone}</strong>` : ""}.
      </p>
    </div>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">You can also save the project as a quote and share notes with our design team before ordering.</p>
  `;

  return {
    subject: "Need Help with Your Layout/Design?",
    html: emailShell({
      preheader: "Our design team can help you finalize your cabinet layout.",
      title: "Need Help with Your Layout/Design?",
      bodyHtml,
      ctaLabel: "Review Saved Project",
      ctaHref: accountQuotesUrl(),
      footerNote: "Reply to this email if you would like a layout review before checkout.",
    }),
  };
}

export function buildAbandonedCartOfferEmail(
  context: AbandonedCartDealerContext,
  offer: { code: string; percent: number }
) {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Hi ${greetingName(context)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">We would love to help you close out this project. For a limited time, use the offer below when you return to checkout.</p>
    <div style="margin:20px 0;padding:22px 20px;border-radius:14px;background:${BRAND_CREAM};border:1px dashed ${BRAND_COPPER};text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;font-weight:700;">Limited project offer</p>
      <p style="margin:0;font-size:28px;font-weight:800;color:${BRAND_COPPER};">${offer.percent}% off</p>
      <p style="margin:8px 0 0;font-size:14px;color:${BRAND_NAVY};">Use code <strong>${offer.code}</strong> at checkout</p>
    </div>
    ${renderCartItemsTable(context)}
  `;

  return {
    subject: "Special Offer to Close Your Project",
    html: emailShell({
      preheader: `Save ${offer.percent}% on your open cabinet project with code ${offer.code}.`,
      title: "Special Offer to Close Your Project",
      bodyHtml,
      ctaLabel: "Apply Discount & Order Now",
      ctaHref: cartPageUrl(),
      footerNote: "Offer applies to your current saved cart total. Contact us if you need a revised quote before ordering.",
    }),
  };
}

export function buildCustomAbandonedCartEmail(input: {
  context: AbandonedCartDealerContext;
  subject: string;
  message: string;
}) {
  const paragraphs = input.message
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">${block.replace(/\n/g, "<br />")}</p>`
    )
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Hi ${greetingName(input.context)},</p>
    ${paragraphs}
    ${renderCartItemsTable(input.context)}
  `;

  return {
    subject: input.subject,
    html: emailShell({
      preheader: input.subject,
      title: input.subject,
      bodyHtml,
      ctaLabel: "Return to Cart",
      ctaHref: cartPageUrl(),
    }),
  };
}
