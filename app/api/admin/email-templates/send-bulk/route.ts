import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  listAllApprovedCustomerIds,
  listApprovedCustomerIdsByDealerGroup,
} from "@/lib/dealer-groups";
import { listApprovedCustomerIdsByGroup } from "@/lib/dealer-email-context";
import { getEmailTemplateById } from "@/lib/email-templates";
import { logBulkEmailCampaign } from "@/lib/email-audit-log";
import { sendBulkTemplateEmail } from "@/lib/email/send-dealer-template";
import { isUserGroupTag } from "@/types/user-segmentation";

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_send_bulk_emails");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    templateId?: unknown;
    groupTag?: unknown;
    dealerGroupId?: unknown;
    sendToAll?: unknown;
  };

  const templateId =
    typeof body.templateId === "number"
      ? body.templateId
      : Number.parseInt(String(body.templateId ?? ""), 10);

  if (!Number.isFinite(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }

  let userIds: number[] = [];
  let targetLabel = "";

  if (body.sendToAll === true) {
    userIds = await listAllApprovedCustomerIds();
    targetLabel = "All approved customers";
  } else if (typeof body.dealerGroupId === "number" || body.dealerGroupId !== undefined) {
    const dealerGroupId =
      typeof body.dealerGroupId === "number"
        ? body.dealerGroupId
        : Number.parseInt(String(body.dealerGroupId ?? ""), 10);

    if (!Number.isFinite(dealerGroupId) || dealerGroupId <= 0) {
      return NextResponse.json({ error: "Invalid dealer group id" }, { status: 400 });
    }

    userIds = await listApprovedCustomerIdsByDealerGroup(dealerGroupId);
    targetLabel = `Dealer group #${dealerGroupId}`;
  } else {
    const groupTag = typeof body.groupTag === "string" ? body.groupTag.trim() : "";

    if (!isUserGroupTag(groupTag)) {
      return NextResponse.json({ error: "Invalid group tag" }, { status: 400 });
    }

    userIds = await listApprovedCustomerIdsByGroup(groupTag);
    targetLabel = `Tier group: ${groupTag}`;
  }

  try {
    const template = await getEmailTemplateById(templateId);

    if (!template) {
      return NextResponse.json({ error: "Email template not found" }, { status: 404 });
    }

    const result = await sendBulkTemplateEmail({
      templateId,
      userIds,
      sentByAdminId: auth.user!.id,
      targetLabel,
    });

    await logBulkEmailCampaign({
      adminUserId: auth.user!.id,
      templateId,
      templateName: template.name,
      targetLabel,
      total: result.total,
      sent: result.sent,
      failed: result.failed,
    });

    return NextResponse.json({
      ok: true,
      message: `Sent ${result.sent} of ${result.total} emails to ${targetLabel}.`,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send bulk email" },
      { status: 400 }
    );
  }
}
