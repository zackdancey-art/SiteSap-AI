import { NextFunction, Request, RequestHandler, Response } from "express";
import { AuthClaims, CompanyRole, UserRole, verifyAuthToken } from "../utils/authToken";

export type AuthenticatedRequest = Request & { auth: AuthClaims };

function extractBearerToken(req: Request) {
  const raw = req.headers.authorization;
  if (!raw) return null;
  const [scheme, token] = raw.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token." });
  }
  const claims = verifyAuthToken(token);
  if (!claims) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
  (req as AuthenticatedRequest).auth = claims;
  return next();
}

// ── Company-role middleware ──────────────────────────────────────────────────
const ROLE_RANK: Record<CompanyRole, number> = { crew: 0, viewer: 1, manager: 2, owner: 3 };

/** Requires the caller's company_role to rank at or above `min`. */
export function requireAtLeast(min: CompanyRole): RequestHandler {
  return (req, res, next) => {
    const role = (req as AuthenticatedRequest).auth?.companyRole;
    if (!role || ROLE_RANK[role] < ROLE_RANK[min]) {
      return res.status(403).json({ error: "Insufficient permissions." });
    }
    next();
  };
}

/** Requires the caller's company_role to be one of `allowed`. */
export function requireCompanyRole(...allowed: CompanyRole[]): RequestHandler {
  return (req, res, next) => {
    const role = (req as AuthenticatedRequest).auth?.companyRole;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ error: "Insufficient permissions." });
    }
    next();
  };
}

/**
 * @deprecated Legacy role gate keyed on the pre-company `role` claim. Kept for
 * any route not yet migrated to company roles. New routes should use
 * requireAtLeast / requireCompanyRole instead.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!roles.includes(auth.role)) {
      return res.status(403).json({ error: "Insufficient permissions." });
    }
    return next();
  };
}
