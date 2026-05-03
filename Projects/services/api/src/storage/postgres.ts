import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool() {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for auth storage.");
  }

  const maxConnections = Number(process.env.PG_POOL_MAX || "10");
  pool = new Pool({
    connectionString: databaseUrl,
    max: isFinite(maxConnections) && maxConnections > 0 ? maxConnections : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl:
      process.env.PG_SSL === "require"
        ? {
            rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : undefined,
  });
  return pool;
}
