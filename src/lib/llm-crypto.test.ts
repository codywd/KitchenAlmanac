import { describe, expect, it } from "vitest";

import {
  createLlmCredentialFingerprint,
  decryptLlmCredential,
  encryptLlmCredential,
} from "./llm-crypto";

const primaryEnv = {
  LLM_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
};
const wrongEnv = {
  LLM_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString("base64"),
};

describe("LLM credential encryption", () => {
  it("round-trips API keys without storing the raw value", () => {
    const encrypted = encryptLlmCredential("sk-live-secret", primaryEnv);

    expect(encrypted.ciphertext).not.toContain("sk-live-secret");
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();
    expect(decryptLlmCredential(encrypted, primaryEnv)).toBe("sk-live-secret");
  });

  it("rejects missing or wrong encryption keys", () => {
    expect(() => encryptLlmCredential("sk-live-secret", {})).toThrow(
      "LLM_CREDENTIAL_ENCRYPTION_KEY",
    );

    const encrypted = encryptLlmCredential("sk-live-secret", primaryEnv);

    expect(() => decryptLlmCredential(encrypted, wrongEnv)).toThrow(
      "Could not decrypt",
    );
  });

  it("creates a non-secret key reference", () => {
    const fingerprint = createLlmCredentialFingerprint();

    expect(fingerprint).toMatch(/^[a-f0-9]{16}$/u);
    expect(fingerprint).not.toBe(createLlmCredentialFingerprint());
    expect(fingerprint).not.toContain("sk-live-secret");
  });
});
