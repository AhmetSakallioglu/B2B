import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  createDealerGroup,
  deleteDealerGroup,
  listDealerGroupMembers,
  listDealerGroups,
  listDealersForManualCoupon,
  updateDealerGroupMembers,
} from "@/lib/dealer-groups";
import {
  logDealerGroupCreated,
  logDealerGroupDeleted,
  logDealerGroupMembersUpdated,
} from "@/lib/email-audit-log";

export async function GET() {
  const auth = await requireAdminPermission("can_manage_dealer_groups");

  if (auth.response) {
    return auth.response;
  }

  const [groups, dealers] = await Promise.all([listDealerGroups(), listDealersForManualCoupon()]);

  return NextResponse.json({ groups, dealers });
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_manage_dealer_groups");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    name?: unknown;
    description?: unknown;
    memberUserIds?: unknown;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const memberUserIds = Array.isArray(body.memberUserIds)
    ? body.memberUserIds
        .map((value) =>
          typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
        )
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  if (!name) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }

  try {
    const group = await createDealerGroup({ name, description });
    const updated = await updateDealerGroupMembers(group.id, memberUserIds);

    await logDealerGroupCreated({
      adminUserId: auth.user!.id,
      groupId: group.id,
      groupName: group.name,
    });

    if (memberUserIds.length > 0) {
      await logDealerGroupMembersUpdated({
        adminUserId: auth.user!.id,
        groupId: group.id,
        groupName: group.name,
        memberCount: updated?.memberCount ?? memberUserIds.length,
      });
    }

    return NextResponse.json({ ok: true, group: updated }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create dealer group" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminPermission("can_manage_dealer_groups");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    groupId?: unknown;
    memberUserIds?: unknown;
  };

  const groupId =
    typeof body.groupId === "number"
      ? body.groupId
      : Number.parseInt(String(body.groupId ?? ""), 10);

  const memberUserIds = Array.isArray(body.memberUserIds)
    ? body.memberUserIds
        .map((value) =>
          typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
        )
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  if (!Number.isFinite(groupId) || groupId <= 0) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  try {
    const group = await updateDealerGroupMembers(groupId, memberUserIds);

    if (!group) {
      return NextResponse.json({ error: "Dealer group not found" }, { status: 404 });
    }

    await logDealerGroupMembersUpdated({
      adminUserId: auth.user!.id,
      groupId: group.id,
      groupName: group.name,
      memberCount: group.memberCount,
    });

    const members = await listDealerGroupMembers(group.id);
    return NextResponse.json({ ok: true, group, members });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update dealer group" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminPermission("can_manage_dealer_groups");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as { groupId?: unknown };
  const groupId =
    typeof body.groupId === "number"
      ? body.groupId
      : Number.parseInt(String(body.groupId ?? ""), 10);

  if (!Number.isFinite(groupId) || groupId <= 0) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  try {
    const groups = await listDealerGroups();
    const group = groups.find((entry) => entry.id === groupId);

    if (!group) {
      return NextResponse.json({ error: "Dealer group not found" }, { status: 404 });
    }

    await deleteDealerGroup(groupId);

    await logDealerGroupDeleted({
      adminUserId: auth.user!.id,
      groupId,
      groupName: group.name,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete dealer group" },
      { status: 400 }
    );
  }
}
