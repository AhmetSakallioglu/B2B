import { getRedisRestConfig, isUpstashRestUrl } from "@/lib/redis-env";

type RedisKvClient = {
  get: (key: string) => Promise<string | null>;
  mget?: (keys: string[]) => Promise<Array<string | null>>;
  set: (
    key: string,
    value: string,
    options?: { ex?: number; px?: number }
  ) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, milliseconds: number) => Promise<number>;
  pttl: (key: string) => Promise<number>;
};

let redisClientPromise: Promise<RedisKvClient | null> | null = null;

async function createRedisKvClient(): Promise<RedisKvClient | null> {
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
        get: (key) => redis.get<string>(key),
        mget: (keys) => redis.mget<string[]>(...keys),
        set: (key, value, options) => {
          if (options?.ex) {
            return redis.set(key, value, { ex: options.ex });
          }

          if (options?.px) {
            return redis.set(key, value, { px: options.px });
          }

          return redis.set(key, value);
        },
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
      get: (key) => redis.get(key),
      mget: (keys) => redis.mget(...keys),
      set: (key, value, options) => {
        if (options?.ex) {
          return redis.set(key, value, "EX", options.ex);
        }

        if (options?.px) {
          return redis.set(key, value, "PX", options.px);
        }

        return redis.set(key, value);
      },
      incr: (key) => redis.incr(key),
      pexpire: (key, milliseconds) => redis.pexpire(key, milliseconds),
      pttl: (key) => redis.pttl(key),
    };
  } catch (error) {
    console.warn("Redis KV unavailable for active defense.", error);
    return null;
  }
}

export async function getRedisKvClient() {
  if (!redisClientPromise) {
    redisClientPromise = createRedisKvClient();
  }

  return redisClientPromise;
}

export function isRedisKvEnabled() {
  return Boolean(getRedisRestConfig());
}

export async function redisMget(keys: string[]): Promise<Array<string | null>> {
  if (keys.length === 0) {
    return [];
  }

  const client = await getRedisKvClient();

  if (!client) {
    return keys.map(() => null);
  }

  try {
    if ("mget" in client && typeof client.mget === "function") {
      return await client.mget(keys);
    }

    return await Promise.all(keys.map((key) => client.get(key)));
  } catch (error) {
    console.warn("Redis MGET failed.", error);
    return keys.map(() => null);
  }
}
