import { NextResponse } from "next/server";
import {
  createEmailTemplate,
  listEmailTemplates,
} from "@/lib/email-templates";
import { requireAdminPermission } from "@/lib/api-auth";
import { getPromoExpiryDays } from "@/lib/automation-settings";
import { logEmailTemplateCreated } from "@/lib/email-audit-log";
import type { EmailTemplateInput } from "@/types/email-template";

function parseTemplateBody(body: unknown): EmailTemplateInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;

  return {
    name: record.name,
    subject: record.subject,
    bodyHtml: record.bodyHtml,
    ctaLabel: record.ctaLabel,
    ctaHref: record.ctaHref,
    sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : undefined,
    isActive: typeof record.isActive === "boolean" ? record.isActive : undefined,
    automationEnabled:
      typeof record.automationEnabled === "boolean" ? record.automationEnabled : undefined,
    automationStage:
      record.automationStage === null
        ? null
        : typeof record.automationStage === "number"
          ? (record.automationStage as 1 | 2 | 3)
          : undefined,
    delayHours:
      record.delayHours === null
        ? null
        : typeof record.delayHours === "number"
          ? record.delayHours
          : undefined,
    issuePromoOnSend:
      typeof record.issuePromoOnSend === "boolean" ? record.issuePromoOnSend : undefined,
    promoDiscountPercent:
      record.promoDiscountPercent === null
        ? null
        : typeof record.promoDiscountPercent === "number"
          ? record.promoDiscountPercent
          : undefined,
    promoExpiryDays:
      record.promoExpiryDays === null
        ? null
        : typeof record.promoExpiryDays === "number"
          ? record.promoExpiryDays
          : undefined,
  } as EmailTemplateInput;
}

export async function GET() {
  const auth = await requireAdminPermission("can_manage_emails");

  if (auth.response) {
    return auth.response;
  }

  const [templates, promoExpiryDays] = await Promise.all([
    listEmailTemplates(),
    getPromoExpiryDays(),
  ]);

  return NextResponse.json({ templates, promoExpiryDays });
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_manage_emails");

  if (auth.response) {
    return auth.response;
  }

  const input = parseTemplateBody(await request.json());

  if (!input) {
    return NextResponse.json({ error: "Invalid template payload" }, { status: 400 });
  }

  try {
    const template = await createEmailTemplate(input);

    await logEmailTemplateCreated({
      adminUserId: auth.user!.id,
      templateId: template.id,
      templateName: template.name,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template" },
      { status: 400 }
    );
  }
}
