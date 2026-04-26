import { describe, expect, it } from "vitest";

import {
  createApiKeyMaterial,
  createSessionToken,
  hashApiKey,
  hashPassword,
  hashSessionToken,
  verifyApiKeyMaterial,
  verifyPassword,
} from "./auth";

describe("auth helpers", () => {
  it("hashes and verifies passwords without storing the plain password", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    expect(passwordHash).not.toContain("correct horse");
    await expect(
      verifyPassword("correct horse battery staple", passwordHash),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong password", passwordHash)).resolves.toBe(
      false,
    );
  });

  it("creates one-time API key material with a stable hash and prefix", () => {
    const material = createApiKeyMaterial("Kitchen iPad");

    expect(material.plainTextKey).toMatch(/^mp_[A-Za-z0-9_-]{10}_[A-Za-z0-9_-]{32}$/);
    expect(material.prefix).toBe(material.plainTextKey.split("_")[1]);
    expect(material.displayName).toBe("Kitchen iPad");
    expect(verifyApiKeyMaterial(material.plainTextKey, material.hash)).toBe(true);
    expect(verifyApiKeyMaterial(`${material.plainTextKey}nope`, material.hash)).toBe(
      false,
    );
    expect(hashApiKey(material.plainTextKey)).toBe(material.hash);
  });

  it("hashes session tokens deterministically without exposing the token", () => {
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);

    expect(token).toHaveLength(48);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).toBe(hashSessionToken(token));
    expect(tokenHash).not.toBe(token);
  });
});
