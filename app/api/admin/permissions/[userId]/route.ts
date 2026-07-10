import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { getAdminPermissions, updateAdminPermissions } from "@/lib/admin-permissions";
import { bumpUserSessionVersion } from "@/lib/session-version";
import {
  ADMIN_PERMISSION_KEYS,
  createEmptyAdminPermissions,
} from "@/types/admin-permissions";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

function parsePermissionsBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const permissions = createEmptyAdminPermissions();

  for (const key of ADMIN_PERMISSION_KEYS) {
    if (typeof record[key] === "boolean") {
      permissions[key] = record[key];
    }
  }

  return permissions;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSuperAdmin();

  if (auth.response) {
    return auth.response;
  }

  const { userId } = await context.params;
  const targetUserId = Number.parseInt(userId, 10);

  if (Number.isNaN(targetUserId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const permissions = await getAdminPermissions(targetUserId);
    return NextResponse.json({ userId: targetUserId, permissions });
  } catch (error) {
    console.error("GET /api/admin/permissions/[userId] failed:", error);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSuperAdmin();

  if (auth.response) {
    return auth.response;
  }

  const { userId } = await context.params;
  const targetUserId = Number.parseInt(userId, 10);

  if (Number.isNaN(targetUserId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = parsePermissionsBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid permissions payload" }, { status: 400 });
  }

  try {
    const permissions = await updateAdminPermissions(
      targetUserId,
      body,
      auth.user!.id
    );

    await bumpUserSessionVersion(targetUserId);

    return NextResponse.json({ userId: targetUserId, permissions });
  } catch (error) {
    if (error instanceof Error && error.message === "SUPER_ADMIN_LOCKED") {
      return NextResponse.json(
        { error: "Super Admin permissions cannot be changed" },
        { status: 400 }
      );
    }

    console.error("PUT /api/admin/permissions/[userId] failed:", error);
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 });
  }
}
