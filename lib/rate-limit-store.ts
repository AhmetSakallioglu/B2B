import { getRedisRestConfig, isUpstashRestUrl } from "@/lib/redis-env";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type MemoryBucket = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, MemoryBucket>();

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  memoryBuckets.set(key, bucket);

  return { allowed: true, retryAfterSeconds: 0 };
}

type RedisCounterClient = {
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, milliseconds: number) => Promise<number>;
  pttl: (key: string) => Promise<number>;
};

let redisClientPromise: Promise<RedisCounterClient | null> | null = null;

async function createRedisClient(): Promise<RedisCounterClient | null> {
  const config = getRedisRestConfig();

  if (!config) {
    return null;
  }

  const { url: redisUrl, token } = config;

  try {
    if (isUpstashRestUrl(redisUrl)) {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url: redisUrl, token });

      return {
        incr: (key) => redis.incr(key),
        pexpire: (key, milliseconds) => redis.pexpire(key, milliseconds),
        pttl: (key) => redis.pttl(key),
      };
    }

    const { default: Redis } = await import("ioredis");
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    await redis.ping();

    return {
      incr: (key) => redis.incr(key),
      pexpire: (key, milliseconds) => redis.pexpire(key, milliseconds),
      pttl: (key) => redis.pttl(key),
    };
  } catch (error) {
    console.warn("Redis rate limit unavailable; falling back to in-memory store.", error);
    return null;
  }
}

async function getRedisClient() {
  if (!redisClientPromise) {
    redisClientPromise = createRedisClient();
  }

  return redisClientPromise;
}

async function checkRedisRateLimit(
  client: RedisCounterClient,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const count = await client.incr(redisKey);

  if (count === 1) {
    await client.pexpire(redisKey, windowMs);
  }

  if (count > limit) {
    const ttlMs = await client.pttl(redisKey);
    const retryAfterSeconds =
      ttlMs > 0 ? Math.max(1, Math.ceil(ttlMs / 1000)) : Math.max(1, Math.ceil(windowMs / 1000));

    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function checkDistributedRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (getRedisRestConfig()) {
    const client = await getRedisClient();

    if (client) {
      try {
        return await checkRedisRateLimit(client, key, limit, windowMs);
      } catch (error) {
        console.warn("Redis rate limit check failed; falling back to in-memory store.", error);
      }
    }
  }

  return checkMemoryRateLimit(key, limit, windowMs);
}
