import crypto from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const [, salt, expectedHex] = parts;
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");

  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}
