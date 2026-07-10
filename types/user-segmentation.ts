export const USER_GROUP_TAGS = ["Tier 1", "Tier 2", "New", "Inactive"] as const;

export type UserGroupTag = (typeof USER_GROUP_TAGS)[number];

export const AUTOMATION_TARGET_GROUPS = ["All", ...USER_GROUP_TAGS] as const;

export type AutomationTargetGroup = (typeof AUTOMATION_TARGET_GROUPS)[number];

export type AutomationSetting = {
  id: number;
  stepNumber: 1 | 2 | 3;
  isActive: boolean;
  targetGroup: AutomationTargetGroup;
  discountPercentage: number;
  delayHours: number;
  issuePromo: boolean;
  updatedAt: string;
};

export type GroupPromoRate = {
  groupTag: UserGroupTag;
  discountPercentage: number;
  isActive: boolean;
  updatedAt: string;
};

export const AUTOMATION_STEP_LABELS: Record<1 | 2 | 3, string> = {
  1: "Step 1 — 2 hours",
  2: "Step 2 — 24 hours",
  3: "Step 3 — 48 hours",
};

export function isUserGroupTag(value: string): value is UserGroupTag {
  return (USER_GROUP_TAGS as readonly string[]).includes(value);
}

export function isAutomationTargetGroup(value: string): value is AutomationTargetGroup {
  return (AUTOMATION_TARGET_GROUPS as readonly string[]).includes(value);
}

export function userMatchesAutomationTarget(
  userGroupTag: string,
  targetGroup: AutomationTargetGroup
) {
  if (targetGroup === "All") {
    return true;
  }

  return userGroupTag === targetGroup;
}
