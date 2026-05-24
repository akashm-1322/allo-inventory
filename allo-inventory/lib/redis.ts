import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis | null };

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("REDIS_URL not set — distributed locking is disabled. Falling back to DB-only locking.");
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    // Log but don't crash — the FOR UPDATE fallback handles correctness.
    console.error("Redis error:", err.message);
  });

  return client;
}

export const redis: Redis | null =
  globalForRedis.redis !== undefined
    ? globalForRedis.redis
    : (() => {
        const client = createRedisClient();
        globalForRedis.redis = client;
        return client;
      })();

/**
 * Attempt to acquire a distributed lock using Redis SET NX EX.
 * Returns true if acquired, false if already held.
 * If Redis is unavailable, returns true (fall through to DB lock).
 */
export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  if (!redis) return true; // No Redis — rely on DB FOR UPDATE

  try {
    const result = await redis.set(`lock:${key}`, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch {
    // Redis flap — fall through to DB lock
    return true;
  }
}

/**
 * Release a distributed lock.
 */
export async function releaseLock(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`lock:${key}`);
  } catch {
    // Best-effort; lock will expire via TTL anyway
  }
}
