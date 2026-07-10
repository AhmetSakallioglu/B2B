import { NextResponse } from "next/server";
import {
  getDealerGroupById,
  listDealerGroupMembers,
  updateDealerGroup,
  updateDealerGroupMembers,
} from "@/lib/dealer-groups";
import { requireAdminPermission } from "@/lib/api-auth";
import { logDealerGroupDetailsUpdated, logDealerGroupMembersUpdated } from "@/lib/email-audit-log";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_dealer_groups");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const groupId = Number.parseInt(id, 10);

  if (!Number.isFinite(groupId) || groupId <= 0) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  const [group, members] = await Promise.all([
    getDealerGroupById(groupId),
    listDealerGroupMembers(groupId),
  ]);

  if (!group) {
    return NextResponse.json({ error: "Dealer group not found" }, { status: 404 });
  }

  return NextResponse.json({ group, members });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_dealer_groups");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const groupId = Number.parseInt(id, 10);

  if (!Number.isFinite(groupId) || groupId <= 0) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: unknown;
    description?: unknown;
    memberUserIds?: unknown;
  };

  try {
    const existingGroup = await getDealerGroupById(groupId);

    if (!existingGroup) {
      return NextResponse.json({ error: "Dealer group not found" }, { status: 404 });
    }

    if (typeof body.name === "string" || typeof body.description === "string") {
      const nextName = typeof body.name === "string" ? body.name : existingGroup.name;

      await updateDealerGroup(groupId, {
        name: typeof body.name === "string" ? body.name : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
      });

      const changes: Record<string, unknown> = {};

      if (typeof body.name === "string" && body.name !== existingGroup.name) {
        changes.name = { from: existingGroup.name, to: body.name };
      }

      if (
        typeof body.description === "string" &&
        body.description !== existingGroup.description
      ) {
        changes.description = {
          from: existingGroup.description,
          to: body.description,
        };
      }

      if (Object.keys(changes).length > 0) {
        await logDealerGroupDetailsUpdated({
          adminUserId: auth.user!.id,
          groupId,
          groupName: nextName,
          changes,
        });
      }
    }

    if (Array.isArray(body.memberUserIds)) {
      const memberUserIds = body.memberUserIds
        .map((value) =>
          typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
        )
        .filter((value) => Number.isFinite(value) && value > 0);

      const group = await updateDealerGroupMembers(groupId, memberUserIds);

      if (group) {
        await logDealerGroupMembersUpdated({
          adminUserId: auth.user!.id,
          groupId: group.id,
          groupName: group.name,
          memberCount: group.memberCount,
        });
      }
    }

    const [group, members] = await Promise.all([
      getDealerGroupById(groupId),
      listDealerGroupMembers(groupId),
    ]);

    if (!group) {
      return NextResponse.json({ error: "Dealer group not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, group, members });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update dealer group" },
      { status: 400 }
    );
  }
}
