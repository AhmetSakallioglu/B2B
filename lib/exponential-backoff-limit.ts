import { getRedisKvClient } from "@/lib/redis-edge-kv";
import type { ExponentialBackoffResult } from "@/types/active-defense";

const FAILURE_WINDOW_MS = 60 * 1000;
const FAILURE_THRESHOLD = 5;
const BASE_LOCKOUT_SECONDS = 60 * 60;
const MAX_LOCKOUT_SECONDS = 24 * 60 * 60;

type MemoryFailureBucket = {
  count: number;
  resetAt: number;
  lockoutUntil: number;
};

const memoryFailureBuckets = new Map<string, MemoryFailureBucket>();

function failureKey(scope: string, ip: string) {
  return `auth:fail:${scope}:${ip}`;
}

function lockoutKey(scope: string, ip: string) {
  return `auth:lockout:${scope}:${ip}`;
}

function normalizeIp(ip: string) {
  return ip.trim().toLowerCase();
}

function calculateLockoutSeconds(failureCount: number) {
  if (failureCount <= FAILURE_THRESHOLD) {
    return 0;
  }

  const exponent = failureCount - FAILURE_THRESHOLD - 1;
  const lockoutSeconds = BASE_LOCKOUT_SECONDS * 2 ** Math.max(0, exponent);

  return Math.min(lockoutSeconds, MAX_LOCKOUT_SECONDS);
}

function checkMemoryBackoff(scope: string, ip: string): ExponentialBackoffResult {
  const normalized = normalizeIp(ip);
  const bucket = memoryFailureBuckets.get(`${scope}:${normalized}`);
  const now = Date.now();

  if (bucket?.lockoutUntil && now < bucket.lockoutUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.lockoutUntil - now) / 1000)),
      failureCount: bucket.count,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    failureCount: bucket?.count ?? 0,
  };
}

function recordMemoryFailure(scope: string, ip: string): ExponentialBackoffResult {
  const normalized = normalizeIp(ip);
  const mapKey = `${scope}:${normalized}`;
  const now = Date.now();
  const existing = memoryFailureBuckets.get(mapKey);

  const bucket =
    !existing || now >= existing.resetAt
      ? { count: 1, resetAt: now + FAILURE_WINDOW_MS, lockoutUntil: 0 }
      : { ...existing, count: existing.count + 1 };

  const lockoutSeconds = calculateLockoutSeconds(bucket.count);

  if (lockoutSeconds > 0) {
    bucket.lockoutUntil = now + lockoutSeconds * 1000;
  }

  memoryFailureBuckets.set(mapKey, bucket);

  if (bucket.lockoutUntil && now < bucket.lockoutUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.lockoutUntil - now) / 1000)),
      failureCount: bucket.count,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    failureCount: bucket.count,
  };
}

export async function checkExponentialBackoff(
  scope: string,
  ip: string
): Promise<ExponentialBackoffResult> {
  const normalized = normalizeIp(ip);

  if (!normalized || normalized === "unknown") {
    return { allowed: true, retryAfterSeconds: 0, failureCount: 0 };
  }

  const client = await getRedisKvClient();

  if (!client) {
    return checkMemoryBackoff(scope, normalized);
  }

  try {
    const activeLockout = await client.get(lockoutKey(scope, normalized));

    if (activeLockout) {
      const ttlMs = await client.pttl(lockoutKey(scope, normalized));

      return {
        allowed: false,
        retryAfterSeconds:
          ttlMs > 0 ? Math.max(1, Math.ceil(ttlMs / 1000)) : BASE_LOCKOUT_SECONDS,
        failureCount: FAILURE_THRESHOLD + 1,
      };
    }

    return { allowed: true, retryAfterSeconds: 0, failureCount: 0 };
  } catch (error) {
    console.warn("Exponential backoff read failed; using memory fallback.", error);
    return checkMemoryBackoff(scope, normalized);
  }
}

export async function recordExponentialBackoffFailure(
  scope: string,
  ip: string
): Promise<ExponentialBackoffResult> {
  const normalized = normalizeIp(ip);

  if (!normalized || normalized === "unknown") {
    return { allowed: true, retryAfterSeconds: 0, failureCount: 0 };
  }

  const client = await getRedisKvClient();

  if (!client) {
    return recordMemoryFailure(scope, normalized);
  }

  try {
    const redisFailureKey = failureKey(scope, normalized);
    const failureCount = await client.incr(redisFailureKey);

    if (failureCount === 1) {
      await client.pexpire(redisFailureKey, FAILURE_WINDOW_MS);
    }

    const lockoutSeconds = calculateLockoutSeconds(failureCount);

    if (lockoutSeconds > 0) {
      await client.set(lockoutKey(scope, normalized), String(failureCount), {
        ex: lockoutSeconds,
      });

      return {
        allowed: false,
        retryAfterSeconds: lockoutSeconds,
        failureCount,
      };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      failureCount,
    };
  } catch (error) {
    console.warn("Exponential backoff write failed; using memory fallback.", error);
    return recordMemoryFailure(scope, normalized);
  }
}

export async function clearExponentialBackoff(scope: string, ip: string) {
  const normalized = normalizeIp(ip);
  memoryFailureBuckets.delete(`${scope}:${normalized}`);

  const client = await getRedisKvClient();

  if (!client) {
    return;
  }

  try {
    await Promise.all([
      client.set(failureKey(scope, normalized), "0", { ex: 1 }),
      client.set(lockoutKey(scope, normalized), "0", { ex: 1 }),
    ]);
  } catch {
    // Non-fatal.
  }
}

export const AUTH_BACKOFF_SCOPES = {
  login: "login",
  register: "register",
  credentials: "credentials",
  cartValidate: "cart-validate",
  suspicious: "suspicious",
} as const;

export type AuthBackoffScope = (typeof AUTH_BACKOFF_SCOPES)[keyof typeof AUTH_BACKOFF_SCOPES];
