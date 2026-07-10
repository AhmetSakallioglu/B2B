import { query } from "@/lib/db";
import { isValidPromoExpiryDays } from "@/lib/automation-settings";
import { sanitizeEmailTemplateHtml } from "@/lib/email/template-sanitizer";
import { sanitizePlainText } from "@/lib/input-sanitization";
import type {
  AbandonedCartEmailLogEntry,
  EmailTemplate,
  EmailTemplateAutomationStage,
  EmailTemplateInput,
  EmailTemplateRecord,
} from "@/types/email-template";

function mapEmailTemplateRow(row: EmailTemplateRecord): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    bodyHtml: row.body_html,
    isSystemDefault: row.is_system_default,
    automationStage: row.automation_stage,
    isActive: row.is_active ?? true,
    automationEnabled: row.automation_enabled ?? true,
    delayHours:
      row.delay_hours !== null && row.delay_hours !== undefined
        ? Number.parseFloat(row.delay_hours)
        : null,
    issuePromoOnSend: row.issue_promo_on_send ?? false,
    promoDiscountPercent:
      row.promo_discount_percent !== null && row.promo_discount_percent !== undefined
        ? Number.parseFloat(row.promo_discount_percent)
        : null,
    promoExpiryDays:
      row.promo_expiry_days !== null && row.promo_expiry_days !== undefined
        ? row.promo_expiry_days
        : null,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const EMAIL_TEMPLATE_SELECT = `
  id,
  name,
  subject,
  body_html,
  is_system_default,
  automation_stage,
  is_active,
  automation_enabled,
  delay_hours,
  issue_promo_on_send,
  promo_discount_percent,
  promo_expiry_days,
  cta_label,
  cta_href,
  sort_order,
  created_at,
  updated_at
`;

function sanitizeTemplateBodyHtml(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().slice(0, 50000);

  if (!trimmed) {
    return null;
  }

  return sanitizeEmailTemplateHtml(trimmed);
}

function parseAutomationStage(value: unknown): EmailTemplateAutomationStage | null | undefined {
  if (value === null) {
    return null;
  }

  if (value === 1 || value === 2 || value === 3) {
    return value;
  }

  return undefined;
}

function sanitizeTemplateInput(input: EmailTemplateInput) {
  const name = sanitizePlainText(input.name, 200, true);
  const subject = sanitizePlainText(input.subject, 500, true);
  const bodyHtml = sanitizeTemplateBodyHtml(input.bodyHtml);
  const ctaLabel = input.ctaLabel
    ? sanitizePlainText(input.ctaLabel, 120, false)
    : null;
  const ctaHref = input.ctaHref ? sanitizePlainText(input.ctaHref, 500, false) : null;
  const automationStage = parseAutomationStage(input.automationStage);

  if (!name || !subject || !bodyHtml) {
    return null;
  }

  const delayHours =
    input.delayHours === null
      ? null
      : typeof input.delayHours === "number" &&
          Number.isFinite(input.delayHours) &&
          input.delayHours > 0 &&
          input.delayHours <= 720
        ? input.delayHours
        : undefined;

  const promoDiscountPercent =
    input.promoDiscountPercent === null
      ? null
      : typeof input.promoDiscountPercent === "number" &&
          Number.isFinite(input.promoDiscountPercent) &&
          input.promoDiscountPercent > 0 &&
          input.promoDiscountPercent <= 100
        ? input.promoDiscountPercent
        : undefined;

  const promoExpiryDays =
    input.promoExpiryDays === null
      ? null
      : typeof input.promoExpiryDays === "number" && isValidPromoExpiryDays(input.promoExpiryDays)
        ? input.promoExpiryDays
        : undefined;

  return {
    name,
    subject,
    bodyHtml,
    ctaLabel,
    ctaHref,
    sortOrder:
      typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
        ? Math.max(0, Math.floor(input.sortOrder))
        : 0,
    isActive: typeof input.isActive === "boolean" ? input.isActive : undefined,
    automationEnabled:
      typeof input.automationEnabled === "boolean" ? input.automationEnabled : undefined,
    automationStage,
    delayHours,
    issuePromoOnSend:
      typeof input.issuePromoOnSend === "boolean" ? input.issuePromoOnSend : undefined,
    promoDiscountPercent,
    promoExpiryDays,
  };
}

export async function listEmailTemplates() {
  const result = await query<EmailTemplateRecord>(
    `
      SELECT ${EMAIL_TEMPLATE_SELECT}
      FROM email_templates
      ORDER BY sort_order ASC, id ASC
    `
  );

  return result.rows.map(mapEmailTemplateRow);
}

export async function getEmailTemplateById(templateId: number) {
  const result = await query<EmailTemplateRecord>(
    `
      SELECT ${EMAIL_TEMPLATE_SELECT}
      FROM email_templates
      WHERE id = $1
    `,
    [templateId]
  );

  const row = result.rows[0];
  return row ? mapEmailTemplateRow(row) : null;
}

export async function getEmailTemplateByAutomationStage(stage: EmailTemplateAutomationStage) {
  const result = await query<EmailTemplateRecord>(
    `
      SELECT ${EMAIL_TEMPLATE_SELECT}
      FROM email_templates
      WHERE automation_stage = $1
        AND is_active = true
        AND automation_enabled = true
      LIMIT 1
    `,
    [stage]
  );

  const row = result.rows[0];
  return row ? mapEmailTemplateRow(row) : null;
}

export async function createEmailTemplate(input: EmailTemplateInput) {
  const sanitized = sanitizeTemplateInput(input);

  if (!sanitized) {
    throw new Error("Invalid email template payload");
  }

  if (sanitized.automationStage) {
    await query(
      `UPDATE email_templates SET automation_stage = NULL WHERE automation_stage = $1`,
      [sanitized.automationStage]
    );
  }

  const result = await query<EmailTemplateRecord>(
    `
      INSERT INTO email_templates (
        name,
        subject,
        body_html,
        is_system_default,
        automation_stage,
        is_active,
        automation_enabled,
        delay_hours,
        issue_promo_on_send,
        promo_discount_percent,
        promo_expiry_days,
        cta_label,
        cta_href,
        sort_order
      )
      VALUES ($1, $2, $3, false, $4, COALESCE($5, true), COALESCE($6, false), $7, COALESCE($8, false), $9, $10, $11, $12, $13)
      RETURNING ${EMAIL_TEMPLATE_SELECT}
    `,
    [
      sanitized.name,
      sanitized.subject,
      sanitized.bodyHtml,
      sanitized.automationStage ?? null,
      sanitized.isActive ?? true,
      sanitized.automationEnabled ?? Boolean(sanitized.automationStage),
      sanitized.delayHours ?? null,
      sanitized.issuePromoOnSend ?? false,
      sanitized.promoDiscountPercent ?? null,
      sanitized.promoExpiryDays ?? null,
      sanitized.ctaLabel,
      sanitized.ctaHref,
      sanitized.sortOrder,
    ]
  );

  return mapEmailTemplateRow(result.rows[0]!);
}

export async function updateEmailTemplate(templateId: number, input: EmailTemplateInput) {
  const existing = await getEmailTemplateById(templateId);

  if (!existing) {
    throw new Error("Email template not found");
  }

  const sanitized = sanitizeTemplateInput(input);

  if (!sanitized) {
    throw new Error("Invalid email template payload");
  }

  const nextAutomationStage =
    sanitized.automationStage !== undefined
      ? sanitized.automationStage
      : existing.automationStage;

  if (nextAutomationStage) {
    await query(
      `
        UPDATE email_templates
        SET automation_stage = NULL
        WHERE automation_stage = $1 AND id <> $2
      `,
      [nextAutomationStage, templateId]
    );
  }

  const result = await query<EmailTemplateRecord>(
    `
      UPDATE email_templates
      SET
        name = $2,
        subject = $3,
        body_html = $4,
        cta_label = $5,
        cta_href = $6,
        sort_order = $7,
        is_active = COALESCE($8, is_active),
        automation_enabled = COALESCE($9, automation_enabled),
        automation_stage = $10,
        delay_hours = $11,
        issue_promo_on_send = COALESCE($12, issue_promo_on_send),
        promo_discount_percent = $13,
        promo_expiry_days = $14,
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${EMAIL_TEMPLATE_SELECT}
    `,
    [
      templateId,
      sanitized.name,
      sanitized.subject,
      sanitized.bodyHtml,
      sanitized.ctaLabel,
      sanitized.ctaHref,
      sanitized.sortOrder,
      sanitized.isActive ?? null,
      sanitized.automationEnabled ?? null,
      nextAutomationStage,
      sanitized.delayHours !== undefined ? sanitized.delayHours : existing.delayHours,
      sanitized.issuePromoOnSend ?? null,
      sanitized.promoDiscountPercent !== undefined
        ? sanitized.promoDiscountPercent
        : existing.promoDiscountPercent,
      sanitized.promoExpiryDays !== undefined
        ? sanitized.promoExpiryDays
        : existing.promoExpiryDays,
    ]
  );

  return mapEmailTemplateRow(result.rows[0]!);
}

export async function updateEmailTemplateFlags(
  templateId: number,
  flags: { isActive?: boolean; automationEnabled?: boolean }
) {
  const existing = await getEmailTemplateById(templateId);

  if (!existing) {
    throw new Error("Email template not found");
  }

  const result = await query<EmailTemplateRecord>(
    `
      UPDATE email_templates
      SET
        is_active = COALESCE($2, is_active),
        automation_enabled = COALESCE($3, automation_enabled),
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${EMAIL_TEMPLATE_SELECT}
    `,
    [templateId, flags.isActive ?? null, flags.automationEnabled ?? null]
  );

  return mapEmailTemplateRow(result.rows[0]!);
}

export async function deleteEmailTemplate(templateId: number) {
  const existing = await getEmailTemplateById(templateId);

  if (!existing) {
    throw new Error("Email template not found");
  }

  if (existing.isSystemDefault) {
    throw new Error("System default templates cannot be deleted");
  }

  await query(`DELETE FROM email_templates WHERE id = $1`, [templateId]);
}

export async function logAbandonedCartEmail(input: {
  userId: number;
  templateId: number | null;
  templateName: string;
  recipientEmail: string;
  subject: string;
  sendType: "automated" | "manual";
  sentBy: number | null;
}) {
  await query(
    `
      INSERT INTO abandoned_cart_email_log (
        user_id,
        template_id,
        template_name,
        recipient_email,
        subject,
        send_type,
        sent_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.userId,
      input.templateId,
      input.templateName,
      input.recipientEmail,
      input.subject,
      input.sendType,
      input.sentBy,
    ]
  );
}

export async function listAbandonedCartEmailLogsForUser(userId: number, limit = 10) {
  const result = await query<{
    id: number;
    user_id: number;
    template_id: number | null;
    template_name: string;
    recipient_email: string;
    subject: string;
    send_type: "automated" | "manual";
    sent_by: number | null;
    sent_at: Date;
  }>(
    `
      SELECT
        id,
        user_id,
        template_id,
        template_name,
        recipient_email,
        subject,
        send_type,
        sent_by,
        sent_at
      FROM abandoned_cart_email_log
      WHERE user_id = $1
      ORDER BY sent_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows.map(
    (row) =>
      ({
        id: row.id,
        userId: row.user_id,
        templateId: row.template_id,
        templateName: row.template_name,
        recipientEmail: row.recipient_email,
        subject: row.subject,
        sendType: row.send_type,
        sentBy: row.sent_by,
        sentAt: row.sent_at.toISOString(),
      }) satisfies AbandonedCartEmailLogEntry
  );
}
