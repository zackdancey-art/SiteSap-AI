/**
 * Preloaded test setup — loaded via `node --require ./dist/test-setup.js` BEFORE
 * the test runner imports any test file.
 *
 * Why this has to be a preload and not per-file code: several modules capture
 * environment-derived values in module-scope constants at first import
 * (e.g. `routes/auth.ts`'s `isProd`/`hasDatabase`, computed once when the
 * module is first required). A test file's own top-level
 * `delete process.env.DATABASE_URL` / `process.env.NODE_ENV = "test"` runs
 * too late to matter: `import { createApp } from "../server"` at the top of
 * that file is hoisted above the file's own statements and pulls in
 * `routes/auth.ts` (and other modules) first, so those constants are already
 * frozen with whatever `.env` set (production DB, live provider keys)
 * before the file's reset lines ever execute. A `--require` preload runs as
 * its own script before Node even begins loading the test file, so these
 * env vars are correct before any app module is ever imported.
 */

process.env.NODE_ENV = "test";

// Deliberately an empty-string assignment, NOT `delete`. This preload runs
// before `server.ts` is ever imported (that's the whole point — see above),
// and `server.ts` calls `dotenv.config()` on import. dotenv's default
// behaviour is to only fill in keys that are *absent* from process.env — an
// empty string still counts as present, so it is left alone, whereas a
// `delete`d key would be silently repopulated from `.env` (including a real
// production DATABASE_URL) the moment `server.ts` loads. Every store's
// `useDatabase()`-style check (`Boolean(DATABASE_URL && DATABASE_URL.trim())`)
// treats "" the same as unset, so behaviour for the rest of the app is
// identical to a deletion — it just also survives dotenv.
process.env.DATABASE_URL = "";

// Same empty-string-not-delete reasoning as DATABASE_URL above: this must
// survive `dotenv.config()` being called later by `instrument.ts`/`server.ts`.
// `routes/ai.ts`'s `if (!process.env.OPENAI_API_KEY)` fallback treats ""
// as falsy, so `tryGenerateWithOpenAI` always uses the local deterministic
// generator in test mode — `client.responses.create()` is never reached.
process.env.OPENAI_API_KEY = "";

if (!process.env.AUTH_TOKEN_SECRET) {
  process.env.AUTH_TOKEN_SECRET = "test-suite-default-secret-do-not-use-in-prod";
}
