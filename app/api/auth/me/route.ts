import { NextResponse } from "next/server";
import { getAdminPermissions } from "@/lib/admin-permissions";
import { getSessionUser } from "@/lib/auth";
import { fetchImpersonationContext } from "@/lib/impersonation";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ user: null, permissions: null, impersonation: null }, { status: 401 });
  }

  let impersonation = null;

  if (user.impersonatedBy) {
    impersonation = await fetchImpersonationContext(user.id, user.impersonatedBy);
  }

  if (user.role !== "admin") {
    return NextResponse.json({ user, permissions: null, impersonation });
  }

  const permissions = await getAdminPermissions(user.id);

  return NextResponse.json({ user, permissions, impersonation });
}
