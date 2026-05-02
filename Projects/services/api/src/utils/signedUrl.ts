import crypto from "crypto";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 2; // 2-hour window

function getSecret() {
  return process.env.AUTH_TOKEN_SECRET || "dev-sitesnap-secret";
}

export function signUploadPath(id: string, filename: string): { sig: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const message = `${id}:${filename}:${exp}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(message).digest("base64url");
  return { sig, exp };
}

export function verifyUploadSignature(id: string, filename: string, sig: string, exp: string | number): boolean {
  const expNum = Number(exp);
  if (!expNum || isNaN(expNum)) return false;
  if (expNum < Math.floor(Date.now() / 1000)) return false;
  const message = `${id}:${filename}:${expNum}`;
  const expected = crypto.createHmac("sha256", getSecret()).update(message).digest("base64url");
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(String(sig));
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
