import fs from "fs/promises";
import path from "path";
import { getPgPool } from "./postgres";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable() {
  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedVersions(): Promise<Set<string>> {
  const result = await getPgPool().query<{ version: string }>(
    `SELECT version FROM schema_migrations ORDER BY version`
  );
  return new Set(result.rows.map((r) => r.version));
}

export async function runMigrations() {
  if (!process.env.DATABASE_URL?.trim()) return;

  await ensureMigrationsTable();
  const applied = await appliedVersions();

  let files: string[];
  try {
    files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    console.warn("[migrate] migrations directory not found, skipping");
    return;
  }

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;

    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
    console.log(`[migrate] applying ${version}`);

    const client = await getPgPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version]);
      await client.query("COMMIT");
      console.log(`[migrate] ${version} applied`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${version} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      client.release();
    }
  }
}
