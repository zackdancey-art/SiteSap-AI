import { PoolClient } from "pg";
import { getPgPool } from "./postgres";
import { Actor } from "./actor";

/**
 * Runs `fn` inside a single transaction on one pooled connection with
 * `app.company_id` set for the life of that transaction. This is the wrapper
 * that supplies the tenant context Row-Level Security reads: RLS policies on
 * tenanted tables compare `company_id` against
 * `current_setting('app.company_id')`, so every query that touches an
 * RLS-forced table MUST run through here.
 *
 * Why a transaction (and not a bare `pool.query`): `set_config(name, value,
 * is_local => true)` is the function form of `SET LOCAL` — the setting is scoped
 * to the current transaction and is reset on COMMIT/ROLLBACK. Because a pool
 * connection is shared across requests, a non-transactional `SET` would leak the
 * previous request's company into the next checkout. Wrapping the whole callback
 * in one transaction also lets multi-statement operations (read-then-write, or
 * report generation touching several tables) share the same tenant context
 * atomically, instead of each statement re-establishing it.
 *
 * Fail-closed: a query that runs on the bare pool (i.e. NOT through withTenant)
 * has no `app.company_id` set; `current_setting('app.company_id', true)` returns
 * NULL there, and `company_id = NULL` excludes every row. A forgotten wrapper
 * yields zero rows, never another tenant's data.
 */
export async function withTenant<T>(
  actor: Pick<Actor, "companyId">,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");
    // is_local = true → SET LOCAL semantics (transaction-scoped, auto-reset).
    await client.query("SELECT set_config('app.company_id', $1, true)", [actor.companyId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback failure; surface the original error */
    }
    throw err;
  } finally {
    client.release();
  }
}
