import { query } from "@/lib/db";
import { sanitizePlainText } from "@/lib/input-sanitization";
import type { DealerGroup, DealerGroupMember, DealerGroupRow } from "@/types/dealer-group";

function mapDealerGroupRow(row: DealerGroupRow): DealerGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    memberCount: Number.parseInt(row.member_count ?? "0", 10),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listDealerGroups() {
  const result = await query<DealerGroupRow>(
    `
      SELECT
        dg.id,
        dg.name,
        dg.description,
        dg.created_at,
        dg.updated_at,
        COUNT(dgm.user_id)::text AS member_count
      FROM dealer_groups dg
      LEFT JOIN dealer_group_members dgm ON dgm.group_id = dg.id
      GROUP BY dg.id
      ORDER BY dg.name ASC
    `
  );

  return result.rows.map(mapDealerGroupRow);
}

export async function getDealerGroupById(groupId: number) {
  const result = await query<DealerGroupRow>(
    `
      SELECT
        dg.id,
        dg.name,
        dg.description,
        dg.created_at,
        dg.updated_at,
        COUNT(dgm.user_id)::text AS member_count
      FROM dealer_groups dg
      LEFT JOIN dealer_group_members dgm ON dgm.group_id = dg.id
      WHERE dg.id = $1
      GROUP BY dg.id
    `,
    [groupId]
  );

  const row = result.rows[0];
  return row ? mapDealerGroupRow(row) : null;
}

export async function createDealerGroup(input: { name: string; description?: string }) {
  const name = sanitizePlainText(input.name, 100, true);
  const description = input.description
    ? sanitizePlainText(input.description, 500, false)
    : "";

  if (!name) {
    throw new Error("Group name is required");
  }

  const result = await query<DealerGroupRow>(
    `
      INSERT INTO dealer_groups (name, description)
      VALUES ($1, $2)
      RETURNING id, name, description, created_at, updated_at, '0' AS member_count
    `,
    [name, description || null]
  );

  return mapDealerGroupRow(result.rows[0]!);
}

export async function updateDealerGroup(
  groupId: number,
  input: { name?: string; description?: string }
) {
  const group = await getDealerGroupById(groupId);

  if (!group) {
    throw new Error("Dealer group not found");
  }

  const name = input.name !== undefined ? sanitizePlainText(input.name, 100, true) : group.name;
  const description =
    input.description !== undefined
      ? sanitizePlainText(input.description, 500, false)
      : group.description;

  if (!name) {
    throw new Error("Group name is required");
  }

  await query(
    `
      UPDATE dealer_groups
      SET name = $2, description = $3, updated_at = NOW()
      WHERE id = $1
    `,
    [groupId, name, description || null]
  );

  return getDealerGroupById(groupId);
}

export async function updateDealerGroupMembers(groupId: number, userIds: number[]) {
  const group = await getDealerGroupById(groupId);

  if (!group) {
    throw new Error("Dealer group not found");
  }

  const uniqueUserIds = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))];

  await query(`DELETE FROM dealer_group_members WHERE group_id = $1`, [groupId]);

  for (const userId of uniqueUserIds) {
    await query(
      `
        INSERT INTO dealer_group_members (group_id, user_id)
        SELECT $1, u.id
        FROM users u
        WHERE u.id = $2 AND u.role = 'customer'
        ON CONFLICT DO NOTHING
      `,
      [groupId, userId]
    );
  }

  return getDealerGroupById(groupId);
}

export async function deleteDealerGroup(groupId: number) {
  const group = await getDealerGroupById(groupId);

  if (!group) {
    throw new Error("Dealer group not found");
  }

  await query(`DELETE FROM dealer_groups WHERE id = $1`, [groupId]);
}

export async function listDealerGroupMembers(groupId: number) {
  const result = await query<{
    user_id: number;
    email: string;
    contact_name: string | null;
    company_name: string | null;
    account_status: string;
  }>(
    `
      SELECT u.id AS user_id, u.email, u.contact_name, u.company_name, u.account_status
      FROM dealer_group_members dgm
      JOIN users u ON u.id = dgm.user_id
      WHERE dgm.group_id = $1
      ORDER BY u.company_name NULLS LAST, u.email ASC
    `,
    [groupId]
  );

  return result.rows.map(
    (row) =>
      ({
        userId: row.user_id,
        email: row.email,
        contactName: row.contact_name,
        companyName: row.company_name,
        accountStatus: row.account_status,
      }) satisfies DealerGroupMember
  );
}

export async function listApprovedCustomerIdsByDealerGroup(groupId: number) {
  const result = await query<{ id: number }>(
    `
      SELECT u.id
      FROM dealer_group_members dgm
      JOIN users u ON u.id = dgm.user_id
      WHERE dgm.group_id = $1
        AND u.role = 'customer'
        AND u.account_status = 'approved'
      ORDER BY u.id ASC
    `,
    [groupId]
  );

  return result.rows.map((row) => row.id);
}

export async function listAllApprovedCustomerIds() {
  const result = await query<{ id: number }>(
    `
      SELECT id
      FROM users
      WHERE role = 'customer'
        AND account_status = 'approved'
      ORDER BY id ASC
    `
  );

  return result.rows.map((row) => row.id);
}

export async function listDealersForManualCoupon() {
  const result = await query<{
    id: number;
    email: string;
    contact_name: string | null;
    company_name: string | null;
    group_tag: string;
    account_status: string;
  }>(
    `
      SELECT id, email, contact_name, company_name, group_tag, account_status
      FROM users
      WHERE role = 'customer'
        AND account_status IN ('approved', 'pending')
      ORDER BY
        CASE account_status WHEN 'approved' THEN 0 ELSE 1 END,
        company_name NULLS LAST,
        contact_name NULLS LAST,
        email ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    contactName: row.contact_name,
    companyName: row.company_name,
    groupTag: row.group_tag ?? "New",
    accountStatus: row.account_status,
    label: [
      row.company_name || row.contact_name || row.email,
      row.email,
      row.account_status === "pending" ? "(Pending approval)" : null,
    ]
      .filter(Boolean)
      .join(" — "),
  }));
}
