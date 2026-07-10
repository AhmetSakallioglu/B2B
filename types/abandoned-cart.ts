export type AbandonedMailStatus = 0 | 1 | 2 | 3;

export type AbandonedCartSettings = {
  automationEnabled: boolean;
  offerCode: string;
  offerPercent: number;
  updatedAt: string;
};

export type AbandonedCartRecoveryRow = {
  user_id: number;
  abandoned_mail_status: AbandonedMailStatus;
  updated_at: Date;
};

export type AbandonedCartEmailStage = 1 | 2 | 3;

export type AbandonedCartLineItem = {
  variantId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string | null;
};

export type AbandonedCartDealerContext = {
  userId: number;
  email: string;
  contactName: string | null;
  companyName: string | null;
  lastCartActivityAt: string;
  mailStatus: AbandonedMailStatus;
  items: AbandonedCartLineItem[];
  cartTotal: number;
};

export type AbandonedCartListItem = {
  userId: number;
  email: string;
  contactName: string | null;
  companyName: string | null;
  cartTotal: number;
  itemCount: number;
  lastActiveAt: string;
  mailStatus: AbandonedMailStatus;
};

export const ABANDONED_MAIL_STATUS_LABELS: Record<AbandonedMailStatus, string> = {
  0: "No emails sent",
  1: "Reminder 1 sent (2h)",
  2: "Support email sent (24h)",
  3: "Offer sent / completed",
};

export const ABANDONED_CART_RECOVERY_HOURS = {
  first: 2,
  second: 24,
  third: 48,
} as const;
