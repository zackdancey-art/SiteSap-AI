import { NextFunction, Request, Response } from "express";
import { AuthClaims, UserRole, verifyAuthToken } from "../utils/authToken";

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
