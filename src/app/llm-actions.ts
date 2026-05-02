"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createLlmCredentialFingerprint,
  decryptLlmCredential,
  encryptLlmCredential,
} from "@/lib/llm-crypto";
import {
  listLlmModels,
  llmProviderKinds,
  normalizeLlmBaseUrl,
  type LlmProviderKind,
} from "@/lib/llm-provider";
import { getDb } from "@/lib/db";
import { requireFamilyContext } from "@/lib/family";
import { toSafeUserLlmSettings, type SafeUserLlmSettings } from "@/lib/llm-settings";

export type LlmSettingsActionState = {
  error?: string;
  message?: string;
  settings?: SafeUserLlmSettings | null;
};

export type DeleteLlmSettingsActionState = {
  message?: string;
};

const llmSettingsSchema = z.object({
  apiKey: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().trim().optional(),
  ),
  baseUrl: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().trim().optional(),
  ),
  displayName: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().trim().optional(),
  ),
  modelId: z.string().trim().min(1),
  providerKind: z.enum(llmProviderKinds),
});

function existingCredential(settings: {
  apiKeyCiphertext: string;
  apiKeyIv: string;
  apiKeyTag: string;
}) {
  return {
    ciphertext: settings.apiKeyCiphertext,
    iv: settings.apiKeyIv,
    tag: settings.apiKeyTag,
  };
}

export async function saveLlmSettingsAction(
  _previousState: LlmSettingsActionState,
  formData: FormData,
): Promise<LlmSettingsActionState> {
  const context = await requireFamilyContext("/account");
  const parsed = llmSettingsSchema.safeParse({
    apiKey: formData.get("apiKey"),
    baseUrl: formData.get("baseUrl"),
    displayName: formData.get("displayName"),
    modelId: formData.get("modelId"),
    providerKind: formData.get("providerKind"),
  });

  if (!parsed.success) {
    return { error: "Choose a provider, model, and valid base URL." };
  }

  const providerKind = parsed.data.providerKind as LlmProviderKind;
  let baseUrl: string;

  try {
    baseUrl = normalizeLlmBaseUrl(parsed.data.baseUrl, providerKind);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Enter a valid provider base URL.",
    };
  }

  const existing = await getDb().userLlmSettings.findUnique({
    where: {
      userId: context.user.id,
    },
  });
  const submittedKey = parsed.data.apiKey?.trim() ?? "";
  let apiKey = submittedKey;
  const encrypted = submittedKey
    ? encryptLlmCredential(submittedKey)
    : existing
      ? existingCredential(existing)
      : null;
  const keyFingerprint = submittedKey
    ? createLlmCredentialFingerprint()
    : existing?.keyFingerprint;

  if (!encrypted || !keyFingerprint) {
    return { error: "Enter an API key before saving LLM settings." };
  }

  if (!apiKey && existing) {
    try {
      apiKey = decryptLlmCredential(existingCredential(existing));
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not read the saved LLM credential.",
      };
    }
  }

  try {
    const models = await listLlmModels({
      apiKey,
      baseUrl,
      providerKind,
    });

    if (!models.some((model) => model.id === parsed.data.modelId)) {
      return { error: "The selected model was not returned by this provider." };
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not verify the selected provider.",
    };
  }

  const now = new Date();
  const data = {
    apiKeyCiphertext: encrypted.ciphertext,
    apiKeyIv: encrypted.iv,
    apiKeyTag: encrypted.tag,
    baseUrl,
    displayName: parsed.data.displayName || null,
    keyFingerprint,
    lastVerifiedAt: now,
    modelId: parsed.data.modelId,
    providerKind,
  };
  const settings = await getDb().userLlmSettings.upsert({
    create: {
      ...data,
      userId: context.user.id,
    },
    update: data,
    where: {
      userId: context.user.id,
    },
  });

  revalidatePath("/account");

  return {
    message: "LLM settings saved.",
    settings: toSafeUserLlmSettings(settings),
  };
}

export async function deleteLlmSettingsAction(
  previousState: DeleteLlmSettingsActionState = {},
): Promise<DeleteLlmSettingsActionState> {
  void previousState;
  const context = await requireFamilyContext("/account");

  await getDb().userLlmSettings.deleteMany({
    where: {
      userId: context.user.id,
    },
  });

  revalidatePath("/account");

  return { message: "LLM settings deleted." };
}
