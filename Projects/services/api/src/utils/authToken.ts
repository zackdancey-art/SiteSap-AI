import crypto from "crypto";

export type UserRole = "worker" | "supervisor" | "admin";

export type AuthClaims = {
  email: string;
  fullName: string;
  role: UserRole;
  iat: number;
  exp: number;
};

const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7);

function getTokenSecret() {
  return process.env.AUTH_TOKEN_SECRET || "dev-sitesnap-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadBase64: string) {
  return crypto.createHmac("sha256", getTokenSecret()).update(payloadBase64).digest("base64url");
}

export function createAuthToken(input: { email: string; fullName: string; role: UserRole }) {
  const now = Math.floor(Date.now() / 1000);
  const claims: AuthClaims = {
    email: input.email,
    fullName: input.fullName,
    role: input.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyAuthToken(token: string): AuthClaims | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expectedSignature = signPayload(payload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const claims = JSON.parse(base64UrlDecode(payload)) as Partial<AuthClaims>;
    if (!claims.email || !claims.exp || !claims.iat || !claims.role || !claims.fullName) {
      return null;
    }
    if (!["worker", "supervisor", "admin"].includes(claims.role)) return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims as AuthClaims;
  } catch {
    return null;
  }
}
