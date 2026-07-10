import { NextResponse } from "next/server";
import {
  deleteEmailTemplate,
  getEmailTemplateById,
  updateEmailTemplate,
  updateEmailTemplateFlags,
} from "@/lib/email-templates";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  logEmailTemplateDeleted,
  logEmailTemplateUpdated,
} from "@/lib/email-audit-log";
import type { EmailTemplateInput } from "@/types/email-template";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_emails");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const templateId = Number.parseInt(id, 10);

  if (!Number.isFinite(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }

  const template = await getEmailTemplateById(templateId);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_emails");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const templateId = Number.parseInt(id, 10);

  if (!Number.isFinite(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  if (body.toggleOnly === true) {
    try {
      const template = await updateEmailTemplateFlags(templateId, {
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
        automationEnabled:
          typeof body.automationEnabled === "boolean" ? body.automationEnabled : undefined,
      });

      await logEmailTemplateUpdated({
        adminUserId: auth.user!.id,
        templateId,
        templateName: template.name,
        changes: {
          is_active: body.isActive,
          automation_enabled: body.automationEnabled,
        },
      });

      return NextResponse.json({ template });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to update template flags" },
        { status: 400 }
      );
    }
  }

  const input = parseTemplateBody(body);

  if (!input) {
    return NextResponse.json({ error: "Invalid template payload" }, { status: 400 });
  }

  try {
    const template = await updateEmailTemplate(templateId, input);

    await logEmailTemplateUpdated({
      adminUserId: auth.user!.id,
      templateId,
      templateName: template.name,
      changes: {
        automation_stage: template.automationStage,
        delay_hours: template.delayHours,
        is_active: template.isActive,
        automation_enabled: template.automationEnabled,
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update template" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_emails");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const templateId = Number.parseInt(id, 10);

  if (!Number.isFinite(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }

  try {
    const existing = await getEmailTemplateById(templateId);

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await deleteEmailTemplate(templateId);

    await logEmailTemplateDeleted({
      adminUserId: auth.user!.id,
      templateId,
      templateName: existing.name,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete template" },
      { status: 400 }
    );
  }
}
