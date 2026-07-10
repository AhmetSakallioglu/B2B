import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { invalidateEdgeSessionState } from "@/lib/session-edge-cache";

type QueryExecutor = Pick<PoolClient, "query">;

export async function bumpUserSessionVersion(
  userId: number,
  client?: QueryExecutor
) {
  const runQuery = client?.query.bind(client) ?? query;

  const result = await runQuery<{ session_version: number }>(
    `
      UPDATE users
      SET
        session_version = session_version + 1,
        updated_at = NOW()
      WHERE id = $1
      RETURNING session_version
    `,
    [userId]
  );

  const sessionVersion = result.rows[0]?.session_version ?? null;

  if (sessionVersion !== null) {
    await invalidateEdgeSessionState(userId);
  }

  return sessionVersion;
}
