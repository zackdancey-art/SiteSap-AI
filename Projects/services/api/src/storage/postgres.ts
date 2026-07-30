import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool() {
  if (pool) {
    return pool;
  }

  // Structural guard: in test mode, never read DATABASE_URL — not even if a
  // test (accidentally or otherwise) set it to a production value. Only an
  // explicit TEST_DATABASE_URL can open a pool during tests, and if that
  // isn't set, fail loudly instead of silently falling through to prod.
  if (process.env.NODE_ENV === "test") {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!testDatabaseUrl) {
      throw new Error(
        "getPgPool() was called in test mode without TEST_DATABASE_URL set. " +
          "Tests must never connect to the production DATABASE_URL — set " +
          "TEST_DATABASE_URL explicitly if a test genuinely needs Postgres."
      );
    }
    pool = new Pool({
      connectionString: testDatabaseUrl,
      ssl:
        process.env.PG_SSL === "require"
          ? {
              rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false",
            }
          : undefined,
    });
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for auth storage.");
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.PG_SSL === "require"
        ? {
            rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : undefined,
  });
  return pool;
}
