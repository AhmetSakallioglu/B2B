import type { NextResponse } from "next/server";
import type { SessionUser } from "@/types/auth";
import type { AdminPermissions } from "@/types/admin-permissions";

export type SessionRole = "customer" | "admin";

export type EdgeSessionContext = {
  role: SessionRole;
  userId: number;
  sessionVersion: number;
};

export type EdgeSessionResolution = {
  session: EdgeSessionContext | null;
  shouldClearCookie: boolean;
};

export type AuthSuccess = {
  user: SessionUser;
  permissions: AdminPermissions | null;
  response: null;
};

export type AuthFailure = {
  user: null;
  permissions: null;
  response: NextResponse;
};

export type AuthResult = AuthSuccess | AuthFailure;

export type ZeroTrustAccessDenialReason =
  | "missing_session"
  | "invalid_session"
  | "wrong_role"
  | "csrf_blocked"
  | "privilege_escalation";
