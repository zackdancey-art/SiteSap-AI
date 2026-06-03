import { Request, Response, NextFunction } from "express";

type RateLimitRecord = { count: number; resetAt: number };
const store = new Map<string, RateLimitRecord>();
const MAX_STORE_SIZE = 50_000;

// Purge expired entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(xff) ? xff[0] : xff;
  return String(forwarded || req.ip || "unknown").split(",")[0].trim();
}

function getAuthUserId(req: Request): string | null {
  const auth = (req as Request & { auth?: { email?: string } }).auth;
  return auth?.email ?? null;
}

export function getRateLimitKey(req: Request, action: string): string {
  // Prefer user identity over IP when available — prevents shared-IP false positives
  // and enables per-user quota enforcement
  const identity = getAuthUserId(req) ?? getClientIp(req);
  return `${action}:${identity}`;
}

export function isRateLimited(req: Request, action: string, maxRequests: number, windowMs: number): boolean {
  // Shed load if the store is abnormally large (e.g. under a scan attack)
  if (store.size >= MAX_STORE_SIZE) {
    // Evict the 1000 entries whose window expires soonest (already expired or about to)
    const sorted = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (const [key] of sorted.slice(0, 1000)) {
      store.delete(key);
    }
  }

  const key = getRateLimitKey(req, action);
  const now = Date.now();
  const current = store.get(key);
  if (!current || now > current.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  store.set(key, current);
  return current.count > maxRequests;
}

export function rateLimit(action: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isRateLimited(req, action, maxRequests, windowMs)) {
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }
    return next();
  };
}
