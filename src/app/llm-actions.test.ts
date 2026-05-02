import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteLlmSettingsAction, saveLlmSettingsAction } from "./llm-actions";

const actionState = vi.hoisted(() => ({
  context: {
    family: {
      id: "family_1",
      name: "Test Family",
    },
    role: "MEMBER" as "ADMIN" | "MEMBER" | "OWNER",
    user: {
      email: "cook@example.local",
      id: "user_1",
      mustChangePassword: false,
      name: "Cook",
    },
  },
  db: null as ReturnType<typeof makeDb>["db"] | null,
  existing: null as null | {
    apiKeyCiphertext: string;
    apiKeyIv: string;
    apiKeyTag: string;
    baseUrl: string;
    displayName: string | null;
    id: string;
    keyFingerprint: string;
    lastUsedAt: Date | null;
    lastVerifiedAt: Date | null;
    modelId: string;
    providerKind: "ANTHROPIC_COMPATIBLE" | "OPENAI_COMPATIBLE";
    updatedAt: Date;
    userId: string;
  },
  listedModels: [{ id: "gpt-5.4-mini", name: "GPT Mini" }],
}));

vi.mock("@/lib/family", () => ({
  requireFamilyContext: vi.fn(async () => actionState.context),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => actionState.db),
}));

vi.mock("@/lib/llm-crypto", () => ({
  createLlmCredentialFingerprint: vi.fn(() => "fp:newkey"),
  decryptLlmCredential: vi.fn(() => "sk-existing"),
  encryptLlmCredential: vi.fn((value: string) => ({
    ciphertext: `encrypted:${value}`,
    iv: "iv",
    tag: "tag",
  })),
}));

vi.mock("@/lib/llm-provider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/llm-provider")>(
    "@/lib/llm-provider",
  );

  return {
    ...actual,
    listLlmModels: vi.fn(async () => actionState.listedModels),
  };
});

function makeDb() {
  const now = new Date("2026-05-02T12:00:00.000Z");
  const db = {
    userLlmSettings: {
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => actionState.existing),
      upsert: vi.fn(async (args: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => ({
        id: "llm_1",
        lastUsedAt: null,
        updatedAt: now,
        userId: "user_1",
        ...args.create,
        ...args.update,
      })),
    },
  };

  return { db };
}

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

describe("LLM settings actions", () => {
  beforeEach(() => {
    actionState.db = makeDb().db;
    actionState.existing = null;
    actionState.listedModels = [{ id: "gpt-5.4-mini", name: "GPT Mini" }];
  });

  it("saves encrypted user-level LLM settings without returning the raw key", async () => {
    const result = await saveLlmSettingsAction(
      {},
      formData({
        apiKey: "sk-new-secret",
        baseUrl: "https://api.openai.com/v1",
        displayName: "OpenAI",
        modelId: "gpt-5.4-mini",
        providerKind: "OPENAI_COMPATIBLE",
      }),
    );

    expect(result.error).toBeUndefined();
    expect(actionState.db?.userLlmSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          apiKeyCiphertext: "encrypted:sk-new-secret",
          keyFingerprint: "fp:newkey",
          userId: "user_1",
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("sk-new-secret");
    expect(JSON.stringify(result)).not.toContain("encrypted:sk-new-secret");
    expect(result.settings).toMatchObject({
      baseUrl: "https://api.openai.com/v1",
      hasApiKey: true,
      modelId: "gpt-5.4-mini",
      providerKind: "OPENAI_COMPATIBLE",
    });
  });

  it("updates model settings while preserving an existing key when the key field is blank", async () => {
    actionState.existing = {
      apiKeyCiphertext: "encrypted:old",
      apiKeyIv: "old-iv",
      apiKeyTag: "old-tag",
      baseUrl: "https://api.openai.com/v1",
      displayName: "Old",
      id: "llm_1",
      keyFingerprint: "fp:ting",
      lastUsedAt: null,
      lastVerifiedAt: null,
      modelId: "gpt-old",
      providerKind: "OPENAI_COMPATIBLE",
      updatedAt: new Date("2026-05-01T00:00:00.000Z"),
      userId: "user_1",
    };

    await saveLlmSettingsAction(
      {},
      formData({
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        modelId: "gpt-5.4-mini",
        providerKind: "OPENAI_COMPATIBLE",
      }),
    );

    expect(actionState.db?.userLlmSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          apiKeyCiphertext: "encrypted:old",
          apiKeyIv: "old-iv",
          apiKeyTag: "old-tag",
        }),
      }),
    );
  });

  it("deletes only the signed-in user's LLM settings", async () => {
    const result = await deleteLlmSettingsAction();

    expect(result).toEqual({ message: "LLM settings deleted." });
    expect(actionState.db?.userLlmSettings.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
      },
    });
  });
});
