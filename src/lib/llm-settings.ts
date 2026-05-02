import { getDb } from "./db";
import {
  decryptLlmCredential,
  type LlmCredentialCiphertext,
} from "./llm-crypto";
import type { LlmProviderKind } from "./llm-provider";

type StoredUserLlmSettings = {
  apiKeyCiphertext: string;
  apiKeyIv: string;
  apiKeyTag: string;
  baseUrl: string;
  displayName: string | null;
  keyFingerprint: string;
  lastUsedAt: Date | null;
  lastVerifiedAt: Date | null;
  modelId: string;
  providerKind: LlmProviderKind;
  updatedAt: Date;
  userId: string;
};

export type SafeUserLlmSettings = {
  baseUrl: string;
  displayName: string | null;
  hasApiKey: boolean;
  keyFingerprint: string;
  lastUsedAt: string | null;
  lastVerifiedAt: string | null;
  modelId: string;
  providerKind: LlmProviderKind;
  updatedAt: string;
};

export type UserLlmProviderMetadata = {
  baseUrl: string;
  modelId: string;
  providerKind: LlmProviderKind;
};

function encryptedPayload(settings: StoredUserLlmSettings): LlmCredentialCiphertext {
  return {
    ciphertext: settings.apiKeyCiphertext,
    iv: settings.apiKeyIv,
    tag: settings.apiKeyTag,
  };
}

export function toSafeUserLlmSettings(
  settings: StoredUserLlmSettings | null,
): SafeUserLlmSettings | null {
  if (!settings) {
    return null;
  }

  return {
    baseUrl: settings.baseUrl,
    displayName: settings.displayName,
    hasApiKey: true,
    keyFingerprint: settings.keyFingerprint,
    lastUsedAt: settings.lastUsedAt?.toISOString() ?? null,
    lastVerifiedAt: settings.lastVerifiedAt?.toISOString() ?? null,
    modelId: settings.modelId,
    providerKind: settings.providerKind,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export async function getUserLlmSettingsForDisplay(userId: string) {
  const settings = await getDb().userLlmSettings.findUnique({
    where: {
      userId,
    },
  });

  return toSafeUserLlmSettings(settings as StoredUserLlmSettings | null);
}

export async function getUserLlmProviderMetadata(
  userId: string,
): Promise<UserLlmProviderMetadata | null> {
  const settings = (await getDb().userLlmSettings.findUnique({
    select: {
      baseUrl: true,
      modelId: true,
      providerKind: true,
    },
    where: {
      userId,
    },
  })) as UserLlmProviderMetadata | null;

  return settings;
}

export async function getUserLlmProviderConfig(userId: string) {
  const settings = (await getDb().userLlmSettings.findUnique({
    where: {
      userId,
    },
  })) as StoredUserLlmSettings | null;

  if (!settings) {
    return null;
  }

  return {
    apiKey: decryptLlmCredential(encryptedPayload(settings)),
    baseUrl: settings.baseUrl,
    modelId: settings.modelId,
    providerKind: settings.providerKind,
  };
}

export async function markUserLlmSettingsUsed(userId: string) {
  await getDb().userLlmSettings.updateMany({
    data: {
      lastUsedAt: new Date(),
    },
    where: {
      userId,
    },
  });
}
