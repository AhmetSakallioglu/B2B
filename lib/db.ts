import { Pool, types } from "pg";
import { assertRequiredEnv } from "@/lib/env";

const TIMESTAMP_TYPES = [1082, 1114, 1184] as const;

for (const typeId of TIMESTAMP_TYPES) {
  types.setTypeParser(typeId, (value) => new Date(value));
}

const globalForPg = globalThis as typeof globalThis & {
  pgPool?: Pool;
};

function createPool() {
  assertRequiredEnv();

  return new Pool({ connectionString: process.env.DATABASE_URL });
}

export const pool = globalForPg.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
) {
  return pool.query<T>(text, params);
}
