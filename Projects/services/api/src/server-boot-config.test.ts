import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { validateProviderConfig } from "./server";

// X2: prove the production boot check treats OPENAI_API_KEY as a hard requirement
// in BOTH directions — absent -> throws an actionable error; present (with every
// other provider satisfied) -> boots without throwing. The dev path must stay a
// warning, never a throw.
//
// validateProviderConfig() is a pure env-check, so we drive it directly rather
// than booting the whole server (migrations/DB/listen). Every env var it reads is
// snapshotted and restored around each test so nothing leaks — including anything
// dotenv loaded from a local services/api/.env.

const ENV_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "AUTH_TOKEN_SECRET",
  "RESEND_API_KEY",
  "SENDGRID_API_KEY",
  "EMAIL_FROM",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "MEDIA_STORAGE_PROVIDER",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_ENDPOINT",
  "AWS_S3_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "OPENAI_API_KEY",
] as const;

let snapshot: Record<string, string | undefined> = {};

// A complete, valid production configuration — every provider satisfied so the
// ONLY variable under test is OPENAI_API_KEY. The AUTH_TOKEN_SECRET is 64 hex
// chars (>=32, and contains none of the placeholder words the check rejects).
function setValidProdEnv() {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgres://u:p@localhost:5432/db";
  process.env.AUTH_TOKEN_SECRET =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.RESEND_API_KEY = "re_live_abc123";
  process.env.EMAIL_FROM = "noreply@sitesnap.app";
  process.env.TWILIO_ACCOUNT_SID = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token-value";
  process.env.TWILIO_FROM_NUMBER = "+15550000000";
  process.env.MEDIA_STORAGE_PROVIDER = "s3";
  process.env.S3_BUCKET = "sitesnap-media";
  process.env.S3_ACCESS_KEY_ID = "AKIAEXAMPLEKEYID";
  process.env.S3_SECRET_ACCESS_KEY = "s3-secret-access-key-value";
  process.env.S3_ENDPOINT = "https://s3.example.com";
}

beforeEach(() => {
  snapshot = {};
  for (const k of ENV_KEYS) snapshot[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
});

test("prod boot THROWS when OPENAI_API_KEY is absent (every other provider present)", () => {
  setValidProdEnv();
  delete process.env.OPENAI_API_KEY;

  assert.throws(
    () => validateProviderConfig(),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // Actionable without reading source: names what's missing, why, and where.
      assert.match(msg, /Missing production configuration/);
      assert.match(msg, /OPENAI_API_KEY/);
      assert.match(msg, /Render/);
      // OPENAI is the SOLE missing item — no other provider name leaks in.
      assert.doesNotMatch(msg, /DATABASE_URL|AUTH_TOKEN_SECRET|Twilio|media storage|email provider/);
      return true;
    }
  );
});

test("prod boot SUCCEEDS when OPENAI_API_KEY is present", () => {
  setValidProdEnv();
  process.env.OPENAI_API_KEY = "sk-live-openai-key-value";

  assert.doesNotThrow(() => validateProviderConfig());
});

test("dev boot does NOT throw when OPENAI_API_KEY is absent (warning only, not a hard fail)", () => {
  process.env.NODE_ENV = "development";
  delete process.env.OPENAI_API_KEY;

  // No providers configured at all — dev degrades to warnings + local fallbacks,
  // so the hard OPENAI requirement must not fire outside production.
  assert.doesNotThrow(() => validateProviderConfig());
});
