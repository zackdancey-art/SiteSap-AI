/**
 * Rate limiter with:
 * - Per-account (email) primary limit for login — so a crew on one shared IP each gets their own budget
 * - Per-IP generous backstop — blocks bots/scanners without throttling legitimate crews
 * - OTP send limits — prevents verification code spam against any one address
 * - All thresholds configurable via env vars (no code change needed to tune)
 * - Redis backend when REDIS_URL is set; in-memory fallback otherwise
 * - Test-mode bypass: only when NODE_ENV === "test" AND RATE_LIMIT_DISABLE === "1"
 */

import { Request, Response, NextFunction } from "express";

// ─── Configuration ──────────────────────────────────────────────────────────

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v !== undefined ? parseInt(v, 10) : NaN;
  return isNaN(n) ? fallback : n;
}

export const LIMITS = {
  // Login: per-account (primary brute-force protection)
  loginPerAccount: {
    max: envInt("RATE_LIMIT_LOGIN_PER_ACCOUNT", 10),
    windowMs: envInt("RATE_LIMIT_LOGIN_PER_ACCOUNT_WINDOW_MS", 15 * 60 * 1000),
  },
  // Login: per-IP (generous backstop — stops scanners, not crews)
  loginPerIp: {
    max: envInt("RATE_LIMIT_LOGIN_PER_IP", 300),
    windowMs: envInt("RATE_LIMIT_LOGIN_PER_IP_WINDOW_MS", 15 * 60 * 1000),
  },
  // Registration initiate: per-IP (one network can onboard a whole crew)
  registerPerIp: {
    max: envInt("RATE_LIMIT_REGISTER_PER_IP", 30),
    windowMs: envInt("RATE_LIMIT_REGISTER_PER_IP_WINDOW_MS", 60 * 60 * 1000),
  },
  // Registration verify: per-IP (slightly higher — retries are common)
  registerVerifyPerIp: {
    max: envInt("RATE_LIMIT_REGISTER_VERIFY_PER_IP", 60),
    windowMs: envInt("RATE_LIMIT_REGISTER_VERIFY_PER_IP_WINDOW_MS", 10 * 60 * 1000),
  },
  // OTP send: per-account burst — prevents an address from being repeatedly spammed
  otpSendPerAccount: {
    max: envInt("RATE_LIMIT_OTP_SEND_PER_ACCOUNT", 5),
    windowMs: envInt("RATE_LIMIT_OTP_SEND_PER_ACCOUNT_WINDOW_MS", 15 * 60 * 1000),
  },
  // OTP send: per-account daily ceiling — belt-and-suspenders against sustained abuse
  otpSendPerAccountDaily: {
    max: envInt("RATE_LIMIT_OTP_SEND_PER_ACCOUNT_DAILY", 20),
    windowMs: envInt("RATE_LIMIT_OTP_SEND_PER_ACCOUNT_DAILY_WINDOW_MS", 24 * 60 * 60 * 1000),
  },
  // OTP send: per-IP — stops a bot cycling through addresses from one host
  otpSendPerIp: {
    max: envInt("RATE_LIMIT_OTP_SEND_PER_IP", 20),
    windowMs: envInt("RATE_LIMIT_OTP_SEND_PER_IP_WINDOW_MS", 60 * 60 * 1000),
  },
  // OTP verify: max failed attempts before the pending registration is invalidated
  otpVerifyMaxAttempts: envInt("RATE_LIMIT_OTP_VERIFY_MAX_ATTEMPTS", 5),
  // Password reset send: per-IP
  forgotPasswordPerIp: {
    max: envInt("RATE_LIMIT_FORGOT_PASSWORD_PER_IP", 8),
    windowMs: envInt("RATE_LIMIT_FORGOT_PASSWORD_PER_IP_WINDOW_MS", 10 * 60 * 1000),
  },
  // Password reset confirm: per-IP
  resetPasswordPerIp: {
    max: envInt("RATE_LIMIT_RESET_PASSWORD_PER_IP", 12),
    windowMs: envInt("RATE_LIMIT_RESET_PASSWORD_PER_IP_WINDOW_MS", 10 * 60 * 1000),
  },
};

// ─── Test-mode bypass ───────────────────────────────────────────────────────

// HARD GATE: both conditions must be true. Production code can never satisfy both
// because NODE_ENV is always "production" in the deployed environment.
function isTestBypassActive(): boolean {
  return process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_DISABLE === "1";
}

// ─── Store abstraction ──────────────────────────────────────────────────────

type RateLimitRecord = { count: number; resetAt: number };
const inMemoryStore = new Map<string, RateLimitRecord>();

// Increment key and return new count. Handles window expiry automatically.
async function increment(key: string, windowMs: number): Promise<number> {
  if (process.env.REDIS_URL) {
    const redis = await getRedisClient();
    if (redis) {
      return incrementRedis(redis, key, windowMs);
    }
  }
  return incrementMemory(key, windowMs);
}

function incrementMemory(key: string, windowMs: number): number {
  const now = Date.now();
  const current = inMemoryStore.get(key);
  if (!current || now > current.resetAt) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  current.count += 1;
  inMemoryStore.set(key, current);
  return current.count;
}

// ─── Redis client (lazy, optional) ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any | null = null;
let redisConnectAttempted = false;

async function getRedisClient(): Promise<unknown | null> {
  if (redisConnectAttempted) return redisClient;
  redisConnectAttempted = true;

  try {
    // Dynamic import so ioredis is optional — falls back to in-memory if not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { default: Redis } = require("ioredis") as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      default: new (url: string) => any;
    };
    const client = new Redis(process.env.REDIS_URL!);
    client.on("error", (err: Error) => {
      console.error("[ratelimit] Redis error — falling back to in-memory:", err.message);
      redisClient = null;
    });
    redisClient = client;
    console.log("[ratelimit] Connected to Redis at", process.env.REDIS_URL);
  } catch {
    console.warn("[ratelimit] ioredis not available — using in-memory rate limit store.");
  }

  return redisClient;
}

async function incrementRedis(redis: unknown, key: string, windowMs: number): Promise<number> {
  const r = redis as {
    incr: (k: string) => Promise<number>;
    expire: (k: string, s: number) => Promise<number>;
    pttl: (k: string) => Promise<number>;
  };
  const count = await r.incr(key);
  if (count === 1) {
    await r.expire(key, Math.ceil(windowMs / 1000));
  } else if (count === 2) {
    // Safety: re-set TTL on second increment in case the first expire didn't land
    const ttl = await r.pttl(key);
    if (ttl < 0) await r.expire(key, Math.ceil(windowMs / 1000));
  }
  return count;
}

// ─── Public API ─────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(xff) ? xff[0] : xff;
  return String(forwarded || req.ip || "unknown").split(",")[0].trim();
}

/**
 * Check if an IP-keyed action is rate-limited.
 * Returns true (blocked) if over the limit.
 */
export async function isRateLimitedByIp(
  req: Request,
  action: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  if (isTestBypassActive()) return false;
  const key = `rl:${action}:ip:${getClientIp(req)}`;
  const count = await increment(key, windowMs);
  return count > max;
}

/**
 * Check if an account-keyed action is rate-limited.
 * Use for login: each user account gets its own counter, independent of IP.
 * Returns true (blocked) if over the limit.
 */
export async function isRateLimitedByAccount(
  identifier: string,
  action: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  if (isTestBypassActive()) return false;
  const key = `rl:${action}:acct:${identifier.toLowerCase()}`;
  const count = await increment(key, windowMs);
  return count > max;
}

/**
 * Legacy / generic rate limit keyed by IP + action.
 * Kept for backward compatibility with auth.ts inline checks.
 */
export async function isRateLimited(
  req: Request,
  action: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  return isRateLimitedByIp(req, action, max, windowMs);
}

/**
 * Express middleware factory (used by ai.ts and uploads.ts routes).
 */
export function rateLimit(action: string, maxRequests: number, windowMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (await isRateLimitedByIp(req, action, maxRequests, windowMs)) {
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }
    return next();
  };
}

/**
 * Reset in-memory store — for use in integration tests only.
 * Has no effect when using Redis (the test should flush Redis itself).
 */
export function resetRateLimitStoreForTests(): void {
  inMemoryStore.clear();
  // Also reset Redis connection state so tests with REDIS_URL get a fresh client
  redisClient = null;
  redisConnectAttempted = false;
}
