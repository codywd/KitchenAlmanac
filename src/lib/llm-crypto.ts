import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const algorithm = "aes-256-gcm";
const keyLength = 32;
const ivLength = 12;

export type LlmCredentialCiphertext = {
  ciphertext: string;
  iv: string;
  tag: string;
};

type EnvLike = Record<string, string | undefined>;

function decodeEncryptionKey(rawValue?: string) {
  const value = rawValue?.trim();

  if (!value) {
    throw new Error("LLM_CREDENTIAL_ENCRYPTION_KEY is required.");
  }

  const candidates = [
    Buffer.from(value, "base64"),
    Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64"),
    /^[a-f0-9]+$/iu.test(value) ? Buffer.from(value, "hex") : Buffer.alloc(0),
    Buffer.from(value, "utf8"),
  ];
  const key = candidates.find((candidate) => candidate.length === keyLength);

  if (!key) {
    throw new Error("LLM_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes.");
  }

  return key;
}

export function createLlmCredentialFingerprint() {
  return randomBytes(8).toString("hex");
}

export function encryptLlmCredential(
  plainText: string,
  env: EnvLike = process.env,
): LlmCredentialCiphertext {
  const key = decodeEncryptionKey(env.LLM_CREDENTIAL_ENCRYPTION_KEY);
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptLlmCredential(
  encrypted: LlmCredentialCiphertext,
  env: EnvLike = process.env,
) {
  try {
    const key = decodeEncryptionKey(env.LLM_CREDENTIAL_ENCRYPTION_KEY);
    const decipher = createDecipheriv(
      algorithm,
      key,
      Buffer.from(encrypted.iv, "base64"),
    );

    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("LLM_CREDENTIAL_ENCRYPTION_KEY")
    ) {
      throw error;
    }

    throw new Error("Could not decrypt the stored LLM credential.");
  }
}
