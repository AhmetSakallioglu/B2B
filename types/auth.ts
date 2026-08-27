export type UserRole = "customer" | "admin";

export type AccountStatus = "pending" | "approved" | "rejected" | "deleted";

export type SessionUser = {
  id: number;
  email: string;
  role: UserRole;
  sessionVersion: number;
  impersonatedBy?: number;
};

export type ImpersonationTokenMeta = {
  impersonatedBy: number;
  adminSessionVersion: number;
};

export type ResolvedSessionUser = SessionUser & {
  adminSessionVersion?: number;
};

export type ImpersonationContext = {
  adminId: number;
  companyName: string | null;
  contactName: string | null;
  customerEmail: string;
};

export type AuthTokenPayload = SessionUser & {
  sub: string;
};

export type AuthErrorCode = "ACCOUNT_PENDING" | "ACCOUNT_REJECTED" | "ACCOUNT_DELETED";

export type LoginErrorResponse = {
  error: string;
  code?: AuthErrorCode;
};

export type RegisterSuccessResponse = {
  pendingApproval: true;
  message: string;
  email: string;
};
