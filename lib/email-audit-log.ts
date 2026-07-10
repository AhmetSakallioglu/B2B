import { writeAuditLog } from "@/lib/audit-log";
import { query } from "@/lib/db";

async function fetchAdminEmail(userId: number | null) {
  if (!userId) {
    return "System";
  }

  const result = await query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId]);
  return result.rows[0]?.email ?? `admin #${userId}`;
}

export async function logEmailTemplateCreated(params: {
  adminUserId: number;
  templateId: number;
  templateName: string;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "email_templates",
    recordId: params.templateId,
    newValues: {
      event: "email_template_created",
      template_name: params.templateName,
      summary: `${adminEmail} created email template "${params.templateName}".`,
    },
  });
}

export async function logEmailTemplateUpdated(params: {
  adminUserId: number;
  templateId: number;
  templateName: string;
  changes: Record<string, unknown>;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "email_templates",
    recordId: params.templateId,
    newValues: {
      event: "email_template_updated",
      template_name: params.templateName,
      ...params.changes,
      summary: `${adminEmail} updated email template "${params.templateName}".`,
    },
  });
}

export async function logEmailTemplateDeleted(params: {
  adminUserId: number;
  templateId: number;
  templateName: string;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "SOFT_DELETE",
    tableName: "email_templates",
    recordId: params.templateId,
    newValues: {
      event: "email_template_deleted",
      template_name: params.templateName,
      summary: `${adminEmail} deleted email template "${params.templateName}".`,
    },
  });
}

export async function logEmailSent(params: {
  adminUserId: number | null;
  dealerUserId: number;
  templateId: number;
  templateName: string;
  recipientEmail: string;
  sendType: "automated" | "manual" | "bulk";
  targetLabel?: string;
}) {
  const actor = await fetchAdminEmail(params.adminUserId);
  const targetSuffix = params.targetLabel ? ` (${params.targetLabel})` : "";

  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "users",
    recordId: params.dealerUserId,
    newValues: {
      event: "dealer_email_sent",
      template_id: params.templateId,
      template_name: params.templateName,
      recipient_email: params.recipientEmail,
      send_type: params.sendType,
      summary: `${actor} sent "${params.templateName}" to ${params.recipientEmail}${targetSuffix}.`,
    },
  });
}

export async function logBulkEmailCampaign(params: {
  adminUserId: number;
  templateId: number;
  templateName: string;
  targetLabel: string;
  total: number;
  sent: number;
  failed: number;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "email_templates",
    recordId: params.templateId,
    newValues: {
      event: "bulk_email_campaign",
      template_name: params.templateName,
      target_label: params.targetLabel,
      total: params.total,
      sent: params.sent,
      failed: params.failed,
      summary: `${adminEmail} sent bulk email "${params.templateName}" to ${params.targetLabel}: ${params.sent}/${params.total} delivered${params.failed > 0 ? `, ${params.failed} failed` : ""}.`,
    },
  });
}

export async function logAutomationSettingsUpdated(params: {
  adminUserId: number;
  stepNumber: number;
  changes: Record<string, unknown>;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "email_templates",
    recordId: params.stepNumber,
    newValues: {
      event: "automation_step_updated",
      step_number: params.stepNumber,
      ...params.changes,
      summary: `${adminEmail} updated abandoned cart automation step ${params.stepNumber}.`,
    },
  });
}

export async function logCouponSettingsUpdated(params: {
  adminUserId: number;
  changes: Record<string, unknown>;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "users",
    recordId: params.adminUserId,
    newValues: {
      event: "coupon_settings_updated",
      ...params.changes,
      summary: `${adminEmail} updated automatic coupon settings.`,
    },
  });
}

export async function logDealerGroupCreated(params: {
  adminUserId: number;
  groupId: number;
  groupName: string;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "dealer_groups",
    recordId: params.groupId,
    newValues: {
      event: "dealer_group_created",
      name: params.groupName,
      summary: `${adminEmail} created dealer group "${params.groupName}".`,
    },
  });
}

export async function logDealerGroupDetailsUpdated(params: {
  adminUserId: number;
  groupId: number;
  groupName: string;
  changes: Record<string, unknown>;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "dealer_groups",
    recordId: params.groupId,
    newValues: {
      event: "dealer_group_details_updated",
      name: params.groupName,
      ...params.changes,
      summary: `${adminEmail} updated dealer group "${params.groupName}".`,
    },
  });
}

export async function logDealerGroupMembersUpdated(params: {
  adminUserId: number;
  groupId: number;
  groupName: string;
  memberCount: number;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "dealer_groups",
    recordId: params.groupId,
    newValues: {
      event: "dealer_group_members_updated",
      name: params.groupName,
      member_count: params.memberCount,
      summary: `${adminEmail} updated members for dealer group "${params.groupName}" (${params.memberCount} dealers).`,
    },
  });
}

export async function logDealerGroupDeleted(params: {
  adminUserId: number;
  groupId: number;
  groupName: string;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "SOFT_DELETE",
    tableName: "dealer_groups",
    recordId: params.groupId,
    newValues: {
      event: "dealer_group_deleted",
      name: params.groupName,
      summary: `${adminEmail} deleted dealer group "${params.groupName}".`,
    },
  });
}

export async function logManualCouponCreated(params: {
  adminUserId: number;
  dealerUserId: number;
  code: string;
  discountValue: number;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);
  const dealerResult = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [params.dealerUserId]
  );
  const dealerEmail = dealerResult.rows[0]?.email ?? `user #${params.dealerUserId}`;

  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "users",
    recordId: params.dealerUserId,
    newValues: {
      event: "manual_coupon_created",
      code: params.code,
      discount_value: params.discountValue,
      summary: `${adminEmail} created manual coupon ${params.code} (${params.discountValue}% off) for dealer ${dealerEmail}.`,
    },
  });
}
