export type DealerGroup = {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DealerGroupMember = {
  userId: number;
  email: string;
  contactName: string | null;
  companyName: string | null;
  accountStatus: string;
};

export type DealerGroupRow = {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  member_count?: string;
};

export type BulkEmailTarget =
  | { type: "tier"; groupTag: string }
  | { type: "dealer_group"; dealerGroupId: number }
  | { type: "all" };
