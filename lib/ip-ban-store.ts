import { getRedisKvClient } from "@/lib/redis-edge-kv";
import type { IpBanTier } from "@/types/active-defense";

const TEMPORARY_BAN_SECONDS = 24 * 60 * 60;
const PERMANENT_BAN_SECONDS = 10 * 365 * 24 * 60 * 60;

type MemoryBanEntry = {
  expiresAt: number | null;
};

const memoryBans = new Map<string, MemoryBanEntry>();

function temporaryBanKey(ip: string) {
  return `ips:ban:temporary:${ip}`;
}

function permanentBanKey(ip: string) {
  return `ips:ban:permanent:${ip}`;
}

function normalizeIp(ip: string) {
  return ip.trim().toLowerCase();
}

function isMemoryBanActive(entry: MemoryBanEntry | undefined) {
  if (!entry) {
    return false;
  }

  if (entry.expiresAt === null) {
    return true;
  }

  return Date.now() < entry.expiresAt;
}

export async function isIpBanned(ip: string): Promise<boolean> {
  const normalized = normalizeIp(ip);

  if (!normalized || normalized === "unknown") {
    return false;
  }

  const memoryEntry = memoryBans.get(normalized);

  if (isMemoryBanActive(memoryEntry)) {
    return true;
  }

  if (memoryEntry) {
    memoryBans.delete(normalized);
  }

  const client = await getRedisKvClient();

  if (!client) {
    return false;
  }

  try {
    const [permanent, temporary] = await Promise.all([
      client.get(permanentBanKey(normalized)),
      client.get(temporaryBanKey(normalized)),
    ]);

    return Boolean(permanent || temporary);
  } catch (error) {
    console.warn("Failed to read IP ban state from Redis.", error);
    return false;
  }
}

export async function banIpTemporary(ip: string, reason: string) {
  const normalized = normalizeIp(ip);

  if (!normalized || normalized === "unknown") {
    return;
  }

  memoryBans.set(normalized, {
    expiresAt: Date.now() + TEMPORARY_BAN_SECONDS * 1000,
  });

  const client = await getRedisKvClient();

  if (!client) {
    return;
  }

  try {
    await client.set(temporaryBanKey(normalized), reason, { ex: TEMPORARY_BAN_SECONDS });
  } catch (error) {
    console.warn("Failed to write temporary IP ban to Redis.", error);
  }
}

export async function banIpPermanent(ip: string, reason: string) {
  const normalized = normalizeIp(ip);

  if (!normalized || normalized === "unknown") {
    return;
  }

  memoryBans.set(normalized, { expiresAt: null });

  const client = await getRedisKvClient();

  if (!client) {
    return;
  }

  try {
    await client.set(permanentBanKey(normalized), reason, { ex: PERMANENT_BAN_SECONDS });
  } catch (error) {
    console.warn("Failed to write permanent IP ban to Redis.", error);
  }
}

export async function recordIpBan(ip: string, tier: IpBanTier, reason: string) {
  if (tier === "permanent") {
    await banIpPermanent(ip, reason);
    return;
  }

  await banIpTemporary(ip, reason);
}
