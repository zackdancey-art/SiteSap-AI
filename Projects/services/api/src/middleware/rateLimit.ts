import { Request, Response, NextFunction } from "express";

type RateLimitRecord = { count: number; resetAt: number };
const store = new Map<string, RateLimitRecord>();

function getClientKey(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(xff) ? xff[0] : xff;
  return String(forwarded || req.ip || "unknown").split(",")[0].trim();
}

export function getRateLimitKey(req: Request, action: string): string {
  return `${action}:${getClientKey(req)}`;
}

export function isRateLimited(req: Request, action: string, maxRequests: number, windowMs: number): boolean {
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
