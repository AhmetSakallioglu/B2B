import { getAbandonedCartSettings } from "@/lib/abandoned-cart";
import { renderEmailFromTemplate } from "@/lib/email/template-renderer";
import { sendEmail } from "@/lib/email/send-email";
import {
  getEmailTemplateById,
  logAbandonedCartEmail,
} from "@/lib/email-templates";
import { loadDealerEmailContext } from "@/lib/dealer-email-context";
import {
  getUserGroupTag,
  resolvePromoDiscountForUser,
} from "@/lib/automation-settings";
import { logEmailSent } from "@/lib/email-audit-log";
import { getPromoExpiryDays } from "@/lib/automation-settings";
import { createPromoCodeForUser } from "@/lib/promo-codes";
import type { AbandonedCartDealerContext } from "@/types/abandoned-cart";
import type { EmailTemplate } from "@/types/email-template";
import type { PromoCode } from "@/types/promo-code";

const BULK_EMAIL_CHUNK_SIZE = 10;

export async function sendDealerTemplateEmail(input: {
  userId: number;
  templateId: number;
  sendType: "automated" | "manual" | "bulk";
  sentByAdminId?: number | null;
  issuePromo?: boolean;
  promoDiscountPercent?: number;
  promoExpiryDays?: number;
  targetLabel?: string;
}) {
  const [template, context, settings] = await Promise.all([
    getEmailTemplateById(input.templateId),
    loadDealerEmailContext(input.userId),
    getAbandonedCartSettings(),
  ]);

  if (!template) {
    throw new Error("Email template not found");
  }

  if (!template.isActive && input.sendType !== "automated") {
    throw new Error("Email template is inactive");
  }

  if (!context) {
    throw new Error("Dealer not found or not eligible for email");
  }

  let issuedPromo: PromoCode | null = null;
  const shouldIssuePromo =
    input.issuePromo ??
    (input.sendType === "automated"
      ? template.automationStage === 3
      : template.issuePromoOnSend);

  if (shouldIssuePromo) {
    const groupTag = await getUserGroupTag(context.userId);
    const discountValue =
      input.promoDiscountPercent ??
      template.promoDiscountPercent ??
      (await resolvePromoDiscountForUser(groupTag, template.automationStage ?? 3));
    const expiryDays =
      input.promoExpiryDays ?? template.promoExpiryDays ?? (await getPromoExpiryDays());

    issuedPromo = await createPromoCodeForUser({
      userId: context.userId,
      discountType: "percentage",
      discountValue,
      expiryDays,
      creationType: input.sendType === "automated" ? "AUTOMATIC" : "MANUAL",
      source:
        input.sendType === "automated" ? "abandoned_cart_template_3" : "manual",
      adminUserId: input.sentByAdminId ?? null,
    });
  }

  const emailContent = renderEmailFromTemplate(template, context, settings, issuedPromo);
  const sendResult = await sendEmail({
    to: context.email,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  if (!sendResult.ok) {
    throw new Error(sendResult.error);
  }

  if (sendResult.skipped) {
    throw new Error("Email transport is not configured");
  }

  await logAbandonedCartEmail({
    userId: context.userId,
    templateId: template.id,
    templateName: template.name,
    recipientEmail: context.email,
    subject: emailContent.subject,
    sendType: input.sendType === "bulk" ? "manual" : input.sendType,
    sentBy: input.sentByAdminId ?? null,
  });

  await logEmailSent({
    adminUserId: input.sentByAdminId ?? null,
    dealerUserId: context.userId,
    templateId: template.id,
    templateName: template.name,
    recipientEmail: context.email,
    sendType: input.sendType,
    targetLabel: input.targetLabel,
  });

  return { context, template, subject: emailContent.subject, issuedPromo };
}

export async function sendBulkTemplateEmail(params: {
  templateId: number;
  userIds: number[];
  sentByAdminId: number;
  targetLabel: string;
  issuePromo?: boolean;
  promoDiscountPercent?: number;
  promoExpiryDays?: number;
}) {
  const template = await getEmailTemplateById(params.templateId);

  if (!template) {
    throw new Error("Email template not found");
  }

  if (!template.isActive) {
    throw new Error("Email template is inactive");
  }

  if (params.userIds.length === 0) {
    throw new Error("No dealers found for the selected target");
  }

  const issuePromo = params.issuePromo ?? template.issuePromoOnSend;
  const promoDiscountPercent =
    params.promoDiscountPercent ?? template.promoDiscountPercent ?? undefined;
  const promoExpiryDays =
    params.promoExpiryDays ?? template.promoExpiryDays ?? undefined;

  const result = {
    total: params.userIds.length,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (let offset = 0; offset < params.userIds.length; offset += BULK_EMAIL_CHUNK_SIZE) {
    const chunk = params.userIds.slice(offset, offset + BULK_EMAIL_CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (userId) => {
        try {
          await sendDealerTemplateEmail({
            userId,
            templateId: params.templateId,
            sendType: "bulk",
            sentByAdminId: params.sentByAdminId,
            issuePromo,
            promoDiscountPercent,
            promoExpiryDays,
            targetLabel: params.targetLabel,
          });
          result.sent += 1;
        } catch (error) {
          result.failed += 1;
          result.errors.push(
            `User ${userId}: ${error instanceof Error ? error.message : "Failed to send email"}`
          );
        }
      })
    );
  }

  return result;
}

export type { AbandonedCartDealerContext, EmailTemplate };
