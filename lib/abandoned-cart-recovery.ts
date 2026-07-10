import { sendDealerTemplateEmail } from "@/lib/email/send-dealer-template";
import { getEmailTemplateByAutomationStage } from "@/lib/email-templates";
import {
  getAutomationDelayHoursForStep,
  getAutomationSettingForStep,
  isAutomaticPromoEnabledForGroup,
  listAutomationSettings,
  resolvePromoDiscountForUser,
} from "@/lib/automation-settings";
import {
  listAbandonedCartRecoveryCandidates,
  markAbandonedCartRecoveryCompleted,
  setAbandonedMailStatus,
  userOrderedSinceCartActivity,
} from "@/lib/abandoned-cart";
import type { AbandonedCartEmailStage } from "@/types/abandoned-cart";
import { userMatchesAutomationTarget } from "@/types/user-segmentation";

export type AbandonedCartRecoveryRunResult = {
  scanned: number;
  sent: number;
  completed: number;
  skipped: number;
  errors: string[];
};

function hoursSince(date: Date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

async function resolveRequiredHoursForStage(stage: AbandonedCartEmailStage) {
  const template = await getEmailTemplateByAutomationStage(stage);

  if (template?.delayHours) {
    return template.delayHours;
  }

  return getAutomationDelayHoursForStep(stage);
}

async function resolveNextStage(
  mailStatus: number,
  hoursElapsed: number
): Promise<AbandonedCartEmailStage | null> {
  if (mailStatus === 0 && hoursElapsed >= (await resolveRequiredHoursForStage(1))) {
    return 1;
  }

  if (mailStatus === 1 && hoursElapsed >= (await resolveRequiredHoursForStage(2))) {
    return 2;
  }

  if (mailStatus === 2 && hoursElapsed >= (await resolveRequiredHoursForStage(3))) {
    return 3;
  }

  return null;
}

export async function processAbandonedCartRecovery(): Promise<AbandonedCartRecoveryRunResult> {
  const automationSettings = await listAutomationSettings();
  const settingsByStep = new Map(
    automationSettings.map((setting) => [setting.stepNumber, setting])
  );

  const result: AbandonedCartRecoveryRunResult = {
    scanned: 0,
    sent: 0,
    completed: 0,
    skipped: 0,
    errors: [],
  };

  const candidates = await listAbandonedCartRecoveryCandidates();
  result.scanned = candidates.length;

  for (const candidate of candidates) {
    const hoursElapsed = hoursSince(candidate.last_active_at);

    if (await userOrderedSinceCartActivity(candidate.user_id, candidate.last_active_at)) {
      await markAbandonedCartRecoveryCompleted(candidate.user_id);
      result.completed += 1;
      continue;
    }

    const nextStage = await resolveNextStage(candidate.mail_status, hoursElapsed);

    if (!nextStage) {
      result.skipped += 1;
      continue;
    }

    const stepSetting = settingsByStep.get(nextStage);

    if (!stepSetting?.isActive) {
      result.skipped += 1;
      continue;
    }

    const userGroupTag = candidate.group_tag ?? "New";

    if (!userMatchesAutomationTarget(userGroupTag, stepSetting.targetGroup)) {
      result.skipped += 1;
      continue;
    }

    const template = await getEmailTemplateByAutomationStage(nextStage);

    if (!template) {
      result.errors.push(`User ${candidate.user_id}: automation template ${nextStage} not found`);
      result.skipped += 1;
      continue;
    }

    if (!template.isActive || !template.automationEnabled) {
      result.skipped += 1;
      continue;
    }

    try {
      const stepConfig = await getAutomationSettingForStep(nextStage);
      const promoEnabled =
        nextStage === 3 &&
        (stepConfig?.issuePromo ?? true) &&
        (await isAutomaticPromoEnabledForGroup(userGroupTag));

      const promoDiscountPercent =
        promoEnabled ? await resolvePromoDiscountForUser(userGroupTag, 3) : undefined;

      await sendDealerTemplateEmail({
        userId: candidate.user_id,
        templateId: template.id,
        sendType: "automated",
        sentByAdminId: null,
        issuePromo: promoEnabled,
        promoDiscountPercent,
      });

      await setAbandonedMailStatus(candidate.user_id, nextStage);
      result.sent += 1;

      if (nextStage === 3) {
        result.completed += 1;
      }
    } catch (error) {
      result.errors.push(
        `User ${candidate.user_id}: ${error instanceof Error ? error.message : "Failed to send email"}`
      );
    }
  }

  return result;
}

export async function sendManualAbandonedCartEmail(input: {
  userId: number;
  templateId: number;
  sentByAdminId: number;
}) {
  const result = await sendDealerTemplateEmail({
    userId: input.userId,
    templateId: input.templateId,
    sendType: "manual",
    sentByAdminId: input.sentByAdminId,
  });

  return result;
}
