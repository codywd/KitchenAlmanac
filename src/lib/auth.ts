import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const passwordKeyLength = 64;

function randomBase64Url(bytes: number, length: number) {
  return randomBytes(bytes).toString("base64url").slice(0, length);
}

function randomApiKeyPart(bytes: number, length: number) {
  return randomBase64Url(bytes, length).replaceAll("_", "-");
}

export async function hashPassword(password: string) {
  const salt = randomBase64Url(24, 32);
  const key = (await scryptAsync(password, salt, passwordKeyLength)) as Buffer;

  return `scrypt$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [scheme, salt, storedKey] = passwordHash.split("$");

  if (scheme !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const stored = Buffer.from(storedKey, "base64url");
  const actual = (await scryptAsync(password, salt, stored.length)) as Buffer;

  return stored.length === actual.length && timingSafeEqual(stored, actual);
}

export function createSessionToken() {
  return randomBytes(36).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function verifyApiKeyMaterial(apiKey: string, expectedHash: string) {
  const actualHash = hashApiKey(apiKey);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createApiKeyMaterial(displayName: string) {
  const prefix = randomApiKeyPart(8, 10);
  const secret = randomApiKeyPart(24, 32);
  const plainTextKey = `mp_${prefix}_${secret}`;

  return {
    displayName: displayName.trim(),
    hash: hashApiKey(plainTextKey),
    plainTextKey,
    prefix,
  };
}
