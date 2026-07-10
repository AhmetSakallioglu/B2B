import { AUTH_BACKOFF_SCOPES } from "@/lib/exponential-backoff-limit";
import { redisMget } from "@/lib/redis-edge-kv";
import type { EdgeSessionContext } from "@/types/zero-trust";

const SESSION_EDGE_TTL_SECONDS = 24 * 60 * 60;

function permanentBanKey(ip: string) {
  return `ips:ban:permanent:${ip}`;
}

function temporaryBanKey(ip: string) {
  return `ips:ban:temporary:${ip}`;
}

function lockoutKey(scope: string, ip: string) {
  return `auth:lockout:${scope}:${ip}`;
}

function sessionEdgeKey(userId: number) {
  return `session:edge:${userId}`;
}

export type EdgeIpSecurityState = {
  banned: boolean;
  authLockedOut: boolean;
};

export async function resolveEdgeIpSecurityState(ip: string): Promise<EdgeIpSecurityState> {
  const normalized = ip.trim().toLowerCase();

  if (!normalized || normalized === "unknown") {
    return { banned: false, authLockedOut: false };
  }

  const [permanentBan, temporaryBan, suspiciousLockout] = await redisMget([
    permanentBanKey(normalized),
    temporaryBanKey(normalized),
    lockoutKey(AUTH_BACKOFF_SCOPES.suspicious, normalized),
  ]);

  return {
    banned: Boolean(permanentBan || temporaryBan),
    authLockedOut: Boolean(suspiciousLockout),
  };
}

export async function resolveEdgeSessionValidity(
  session: EdgeSessionContext
): Promise<boolean | null> {
  const [cachedState] = await redisMget([sessionEdgeKey(session.userId)]);

  if (!cachedState) {
    return null;
  }

  const [sessionVersionRaw, usableRaw] = cachedState.split(":");

  const cachedSessionVersion = Number.parseInt(sessionVersionRaw ?? "", 10);

  if (!Number.isInteger(cachedSessionVersion) || cachedSessionVersion <= 0) {
    return null;
  }

  return cachedSessionVersion === session.sessionVersion && usableRaw === "1";
}

export function buildSessionEdgeCacheValue(sessionVersion: number, accountUsable: boolean) {
  return `${sessionVersion}:${accountUsable ? 1 : 0}`;
}

export { SESSION_EDGE_TTL_SECONDS, sessionEdgeKey };
