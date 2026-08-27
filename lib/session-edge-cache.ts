import { getRedisKvClient, isRedisKvEnabled } from "@/lib/redis-edge-kv";
import {
  SESSION_EDGE_TTL_SECONDS,
  buildSessionEdgeCacheValue,
  sessionEdgeKey,
} from "@/lib/edge-security-batch";

export function isSessionEdgeCacheEnabled() {
  return isRedisKvEnabled();
}

export async function cacheSessionVersion(userId: number, sessionVersion: number) {
  await cacheEdgeSessionState(userId, sessionVersion, true);
}

export async function cacheEdgeSessionState(
  userId: number,
  sessionVersion: number,
  accountUsable: boolean
) {
  const client = await getRedisKvClient();

  if (!client) {
    return;
  }

  try {
    await client.set(
      sessionEdgeKey(userId),
      buildSessionEdgeCacheValue(sessionVersion, accountUsable),
      { ex: SESSION_EDGE_TTL_SECONDS }
    );
  } catch (error) {
    console.warn("Failed to cache edge session state in Redis.", error);
  }
}

export async function invalidateEdgeSessionState(
  userId: number,
  sessionVersion?: number | null
) {
  const client = await getRedisKvClient();

  if (!client) {
    return;
  }

  const version = sessionVersion && sessionVersion > 0 ? sessionVersion : 1;

  try {
    await client.set(
      sessionEdgeKey(userId),
      buildSessionEdgeCacheValue(version, false),
      { ex: SESSION_EDGE_TTL_SECONDS }
    );
  } catch (error) {
    console.warn("Failed to invalidate edge session state in Redis.", error);
  }
}

export async function isCachedSessionVersionValid(
  userId: number,
  sessionVersion: number
): Promise<boolean | null> {
  const client = await getRedisKvClient();

  if (!client) {
    return null;
  }

  try {
    const value = await client.get(sessionEdgeKey(userId));

    if (value === null || value === undefined) {
      return null;
    }

    const [cachedSessionVersionRaw, usableRaw] = String(value).split(":");
    const cachedSessionVersion = Number.parseInt(cachedSessionVersionRaw ?? "", 10);

    if (!Number.isInteger(cachedSessionVersion) || cachedSessionVersion <= 0) {
      return null;
    }

    return cachedSessionVersion === sessionVersion && usableRaw === "1";
  } catch (error) {
    console.warn("Failed to read edge session state from Redis.", error);
    return null;
  }
}

export { resolveEdgeSessionValidity } from "@/lib/edge-security-batch";
