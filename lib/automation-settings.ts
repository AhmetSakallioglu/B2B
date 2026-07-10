import { query } from "@/lib/db";
import { PROMO_DEFAULT_EXPIRY_DAYS } from "@/types/promo-code";
import {
  isAutomationTargetGroup,
  isUserGroupTag,
  USER_GROUP_TAGS,
  type AutomationSetting,
  type AutomationTargetGroup,
  type GroupPromoRate,
} from "@/types/user-segmentation";

type AutomationSettingRow = {
  id: number;
  step_number: number;
  is_active: boolean;
  target_group: string;
  discount_percentage: string;
  delay_hours: string | null;
  issue_promo: boolean;
  updated_at: Date;
};

type GroupPromoRateRow = {
  group_tag: string;
  discount_percentage: string;
  is_active: boolean;
  updated_at: Date;
};

const DEFAULT_STEP_DELAY_HOURS: Record<1 | 2 | 3, number> = {
  1: 2,
  2: 24,
  3: 48,
};

function mapAutomationRow(row: AutomationSettingRow): AutomationSetting {
  const stepNumber = row.step_number as 1 | 2 | 3;

  return {
    id: row.id,
    stepNumber,
    isActive: row.is_active,
    targetGroup: row.target_group as AutomationTargetGroup,
    discountPercentage: Number.parseFloat(row.discount_percentage),
    delayHours:
      row.delay_hours !== null
        ? Number.parseFloat(row.delay_hours)
        : DEFAULT_STEP_DELAY_HOURS[stepNumber],
    issuePromo: row.issue_promo,
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapGroupRateRow(row: GroupPromoRateRow): GroupPromoRate {
  return {
    groupTag: row.group_tag as GroupPromoRate["groupTag"],
    discountPercentage: Number.parseFloat(row.discount_percentage),
    isActive: row.is_active,
    updatedAt: row.updated_at.toISOString(),
  };
}

const AUTOMATION_SETTING_SELECT = `
  id, step_number, is_active, target_group, discount_percentage,
  delay_hours, issue_promo, updated_at
`;

export async function listAutomationSettings() {
  const result = await query<AutomationSettingRow>(
    `
      SELECT ${AUTOMATION_SETTING_SELECT}
      FROM automation_settings
      ORDER BY step_number ASC
    `
  );

  return result.rows.map(mapAutomationRow);
}

export async function getAutomationSettingForStep(stepNumber: 1 | 2 | 3) {
  const result = await query<AutomationSettingRow>(
    `
      SELECT ${AUTOMATION_SETTING_SELECT}
      FROM automation_settings
      WHERE step_number = $1
    `,
    [stepNumber]
  );

  const row = result.rows[0];
  return row ? mapAutomationRow(row) : null;
}

export async function getAutomationDelayHoursForStep(stepNumber: 1 | 2 | 3) {
  const setting = await getAutomationSettingForStep(stepNumber);
  return setting?.delayHours ?? DEFAULT_STEP_DELAY_HOURS[stepNumber];
}

export async function updateAutomationStep(params: {
  stepNumber: 1 | 2 | 3;
  isActive?: boolean;
  targetGroup?: AutomationTargetGroup;
  discountPercentage?: number;
  delayHours?: number;
  issuePromo?: boolean;
}) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (typeof params.isActive === "boolean") {
    updates.push(`is_active = $${index++}`);
    values.push(params.isActive);
  }

  if (params.targetGroup && isAutomationTargetGroup(params.targetGroup)) {
    updates.push(`target_group = $${index++}`);
    values.push(params.targetGroup);
  }

  if (
    typeof params.discountPercentage === "number" &&
    Number.isFinite(params.discountPercentage) &&
    params.discountPercentage >= 0 &&
    params.discountPercentage <= 100
  ) {
    updates.push(`discount_percentage = $${index++}`);
    values.push(params.discountPercentage);
  }

  if (
    typeof params.delayHours === "number" &&
    Number.isFinite(params.delayHours) &&
    params.delayHours > 0 &&
    params.delayHours <= 720
  ) {
    updates.push(`delay_hours = $${index++}`);
    values.push(params.delayHours);
  }

  if (typeof params.issuePromo === "boolean") {
    updates.push(`issue_promo = $${index++}`);
    values.push(params.issuePromo);
  }

  if (updates.length === 0) {
    return getAutomationSettingForStep(params.stepNumber);
  }

  updates.push("updated_at = NOW()");
  values.push(params.stepNumber);

  await query(
    `
      UPDATE automation_settings
      SET ${updates.join(", ")}
      WHERE step_number = $${index}
    `,
    values
  );

  return getAutomationSettingForStep(params.stepNumber);
}

export async function getAutomaticCouponsEnabled() {
  const result = await query<{ automatic_coupons_enabled: boolean }>(
    `SELECT automatic_coupons_enabled FROM abandoned_cart_settings WHERE id = 1`
  );

  return result.rows[0]?.automatic_coupons_enabled ?? true;
}

export async function updateAutomaticCouponsEnabled(enabled: boolean) {
  await query(
    `
      UPDATE abandoned_cart_settings
      SET automatic_coupons_enabled = $1, updated_at = NOW()
      WHERE id = 1
    `,
    [enabled]
  );

  return getAutomaticCouponsEnabled();
}

export function isValidPromoExpiryDays(value: number) {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 1 && value <= 365;
}

export async function getPromoExpiryDays() {
  const result = await query<{ promo_expiry_days: number }>(
    `SELECT promo_expiry_days FROM abandoned_cart_settings WHERE id = 1`
  );

  const days = result.rows[0]?.promo_expiry_days;

  return typeof days === "number" && isValidPromoExpiryDays(days)
    ? days
    : PROMO_DEFAULT_EXPIRY_DAYS;
}

export async function updatePromoExpiryDays(days: number) {
  if (!isValidPromoExpiryDays(days)) {
    throw new Error("Expiry days must be between 1 and 365");
  }

  await query(
    `
      UPDATE abandoned_cart_settings
      SET promo_expiry_days = $1, updated_at = NOW()
      WHERE id = 1
    `,
    [days]
  );

  return getPromoExpiryDays();
}

export async function listGroupPromoRates() {
  const result = await query<GroupPromoRateRow>(
    `
      SELECT group_tag, discount_percentage, is_active, updated_at
      FROM group_promo_rates
      ORDER BY group_tag ASC
    `
  );

  const rates = result.rows.map(mapGroupRateRow);
  const existing = new Set(rates.map((rate) => rate.groupTag));

  for (const groupTag of USER_GROUP_TAGS) {
    if (!existing.has(groupTag)) {
      rates.push({
        groupTag,
        discountPercentage: 5,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return rates.sort((left, right) => left.groupTag.localeCompare(right.groupTag));
}

export async function getGroupPromoRate(groupTag: string) {
  const result = await query<GroupPromoRateRow>(
    `
      SELECT group_tag, discount_percentage, is_active, updated_at
      FROM group_promo_rates
      WHERE group_tag = $1
    `,
    [groupTag]
  );

  const row = result.rows[0];
  return row ? mapGroupRateRow(row) : null;
}

export async function isAutomaticPromoEnabledForGroup(groupTag: string) {
  const globalEnabled = await getAutomaticCouponsEnabled();

  if (!globalEnabled) {
    return false;
  }

  const groupRate = await getGroupPromoRate(groupTag);
  return groupRate?.isActive ?? true;
}

export async function resolvePromoDiscountForUser(groupTag: string, stepNumber?: 1 | 2 | 3) {
  const groupRate = await getGroupPromoRate(groupTag);

  if (groupRate?.isActive) {
    return groupRate.discountPercentage;
  }

  if (stepNumber) {
    const step = await getAutomationSettingForStep(stepNumber);

    if (step) {
      return step.discountPercentage;
    }
  }

  return 5;
}

export async function upsertGroupPromoRate(
  groupTag: string,
  discountPercentage: number,
  isActive?: boolean
) {
  if (!isUserGroupTag(groupTag)) {
    throw new Error("Invalid group tag");
  }

  if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
    throw new Error("Invalid discount percentage");
  }

  await query(
    `
      INSERT INTO group_promo_rates (group_tag, discount_percentage, is_active)
      VALUES ($1, $2, COALESCE($3, true))
      ON CONFLICT (group_tag)
      DO UPDATE SET
        discount_percentage = EXCLUDED.discount_percentage,
        is_active = COALESCE($3, group_promo_rates.is_active),
        updated_at = NOW()
    `,
    [groupTag, discountPercentage, isActive ?? null]
  );

  return getGroupPromoRate(groupTag);
}

export async function upsertGroupPromoRates(
  rates: Array<{ groupTag: string; discountPercentage: number; isActive?: boolean }>
) {
  for (const rate of rates) {
    await upsertGroupPromoRate(rate.groupTag, rate.discountPercentage, rate.isActive);
  }

  return listGroupPromoRates();
}

export async function getUserGroupTag(userId: number) {
  const result = await query<{ group_tag: string }>(
    `SELECT group_tag FROM users WHERE id = $1`,
    [userId]
  );

  return result.rows[0]?.group_tag ?? "New";
}

export async function listUsersByGroupTag(groupTag: string) {
  if (!isAutomationTargetGroup(groupTag) || groupTag === "All") {
    throw new Error("Invalid group tag for user listing");
  }

  const result = await query<{
    id: number;
    email: string;
    contact_name: string | null;
    company_name: string | null;
    group_tag: string;
  }>(
    `
      SELECT id, email, contact_name, company_name, group_tag
      FROM users
      WHERE role = 'customer'
        AND account_status = 'approved'
        AND group_tag = $1
      ORDER BY email ASC
    `,
    [groupTag]
  );

  return result.rows;
}
