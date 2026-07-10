import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  listAutomationSettings,
  updateAutomationStep,
} from "@/lib/automation-settings";
import { logAutomationSettingsUpdated } from "@/lib/email-audit-log";
import { isAutomationTargetGroup } from "@/types/user-segmentation";

export async function GET() {
  const auth = await requireAdminPermission("can_manage_emails");

  if (auth.response) {
    return auth.response;
  }

  const settings = await listAutomationSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminPermission("can_manage_emails");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    stepNumber?: unknown;
    isActive?: unknown;
    targetGroup?: unknown;
    discountPercentage?: unknown;
    delayHours?: unknown;
    issuePromo?: unknown;
  };

  const stepNumber =
    typeof body.stepNumber === "number"
      ? body.stepNumber
      : Number.parseInt(String(body.stepNumber ?? ""), 10);

  if (![1, 2, 3].includes(stepNumber)) {
    return NextResponse.json({ error: "stepNumber must be 1, 2, or 3" }, { status: 400 });
  }

  const targetGroup =
    typeof body.targetGroup === "string" && isAutomationTargetGroup(body.targetGroup)
      ? body.targetGroup
      : undefined;

  const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;
  const issuePromo = typeof body.issuePromo === "boolean" ? body.issuePromo : undefined;

  const discountPercentage =
    typeof body.discountPercentage === "number"
      ? body.discountPercentage
      : body.discountPercentage !== undefined
        ? Number.parseFloat(String(body.discountPercentage))
        : undefined;

  const delayHours =
    typeof body.delayHours === "number"
      ? body.delayHours
      : body.delayHours !== undefined
        ? Number.parseFloat(String(body.delayHours))
        : undefined;

  try {
    const setting = await updateAutomationStep({
      stepNumber: stepNumber as 1 | 2 | 3,
      isActive,
      targetGroup,
      discountPercentage,
      delayHours,
      issuePromo,
    });

    await logAutomationSettingsUpdated({
      adminUserId: auth.user!.id,
      stepNumber,
      changes: {
        is_active: isActive,
        target_group: targetGroup,
        discount_percentage: discountPercentage,
        delay_hours: delayHours,
        issue_promo: issuePromo,
      },
    });

    return NextResponse.json({ ok: true, setting });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update automation step" },
      { status: 400 }
    );
  }
}
