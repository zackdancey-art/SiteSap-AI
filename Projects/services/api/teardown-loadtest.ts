/**
 * SiteSnap Load Test Teardown
 *
 * Deletes ALL data created by load-test.ts.
 * NEVER run against production.
 *
 *   DATABASE_URL=postgres://localhost/sitesnap_test pnpm run teardown-loadtest
 */

import { Pool } from "pg";

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) throw new Error("DATABASE_URL is not set.");

  const prodPatterns = [
    "render.com", "supabase.co", "neon.tech", "rds.amazonaws.com",
    "railway.app", "planetscale.com", "cockroachdb.com", "fly.io",
    "heroku.com", "aiven.io",
  ];
  if (prodPatterns.some((p) => dbUrl.toLowerCase().includes(p))) {
    throw new Error("DATABASE_URL looks like production — teardown aborted.");
  }

  console.log(`\n🧹 SiteSnap Load Test Teardown`);
  console.log(`   DB: ${dbUrl.replace(/:[^:@]+@/, ":***@")}`);
  console.log("   Starting in 3 seconds... Press Ctrl+C to abort.");
  await new Promise((r) => setTimeout(r, 3000));

  const pool = new Pool({ connectionString: dbUrl });

  try {
    const entryResult = await pool.query(
      `DELETE FROM project_entries WHERE owner_email LIKE 'loadtest+%@sitesnap.test'`
    );
    console.log(`✅ Deleted ${entryResult.rowCount ?? 0} entries.`);

    const diaryResult = await pool.query(
      `DELETE FROM project_diaries WHERE owner_email LIKE 'loadtest+%@sitesnap.test'`
    );
    console.log(`✅ Deleted ${diaryResult.rowCount ?? 0} diaries.`);

    const siteResult = await pool.query(
      `DELETE FROM project_sites WHERE owner_email LIKE 'loadtest+%@sitesnap.test' OR name LIKE 'LOADTEST-%'`
    );
    console.log(`✅ Deleted ${siteResult.rowCount ?? 0} sites.`);

    const pendingResult = await pool.query(
      `DELETE FROM auth_pending_registrations WHERE email LIKE 'loadtest+%@sitesnap.test'`
    );
    console.log(`✅ Deleted ${pendingResult.rowCount ?? 0} pending registrations.`);

    const resetResult = await pool.query(
      `DELETE FROM auth_password_reset_tokens WHERE email LIKE 'loadtest+%@sitesnap.test'`
    );
    console.log(`✅ Deleted ${resetResult.rowCount ?? 0} reset tokens.`);

    const userResult = await pool.query(
      `DELETE FROM auth_users WHERE email LIKE 'loadtest+%@sitesnap.test'`
    );
    console.log(`✅ Deleted ${userResult.rowCount ?? 0} users.`);

    console.log("\n✅ Teardown complete.\n");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\n❌ Teardown failed:", err.message ?? err);
  process.exit(1);
});
