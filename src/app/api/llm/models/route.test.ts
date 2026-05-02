import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    actorUserId?: string;
    authType: "apiKey" | "session";
    family: {
      id: string;
      name: string;
    };
    role: "ADMIN" | "MEMBER" | "OWNER";
    user: null | {
      email: string;
      id: string;
      mustChangePassword: boolean;
      name: string | null;
    };
  },
  listCalls: [] as unknown[],
  providerConfigCalls: 0,
  providerConfigError: null as Error | null,
  providerMetadataCalls: 0,
  savedConfig: null as null | {
    apiKey: string;
    baseUrl: string;
    modelId: string;
    providerKind: "ANTHROPIC_COMPATIBLE" | "OPENAI_COMPATIBLE";
  },
  savedMetadata: null as null | {
    baseUrl: string;
    modelId: string;
    providerKind: "ANTHROPIC_COMPATIBLE" | "OPENAI_COMPATIBLE";
  },
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/llm-provider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/llm-provider")>(
    "@/lib/llm-provider",
  );

  return {
    ...actual,
    listLlmModels: vi.fn(async (input: unknown) => {
      routeState.listCalls.push(input);

      return [{ id: "model_1", name: "Model 1" }];
    }),
  };
});

vi.mock("@/lib/llm-settings", () => ({
  getUserLlmProviderConfig: vi.fn(async () => {
    routeState.providerConfigCalls += 1;

    if (routeState.providerConfigError) {
      throw routeState.providerConfigError;
    }

    return routeState.savedConfig;
  }),
  getUserLlmProviderMetadata: vi.fn(async () => {
    routeState.providerMetadataCalls += 1;

    return routeState.savedMetadata;
  }),
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );

  return {
    ...actual,
    assertRateLimit: vi.fn(async () => null),
  };
});

function sessionAuth() {
  return {
    actorUserId: "user_1",
    authType: "session" as const,
    family: {
      id: "family_1",
      name: "Test Family",
    },
    role: "MEMBER" as const,
    user: {
      email: "cook@example.local",
      id: "user_1",
      mustChangePassword: false,
      name: "Cook",
    },
  };
}

function request(body: unknown, init?: RequestInit) {
  return new Request("https://meals.example/api/llm/models", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin: "https://meals.example",
      ...(init?.headers ?? {}),
    },
    method: "POST",
    ...init,
  });
}

describe("POST /api/llm/models", () => {
  beforeEach(() => {
    routeState.auth = null;
    routeState.listCalls = [];
    routeState.providerConfigCalls = 0;
    routeState.providerConfigError = null;
    routeState.providerMetadataCalls = 0;
    routeState.savedConfig = null;
    routeState.savedMetadata = null;
  });

  it("requires a signed-in user session", async () => {
    expect((await POST(request({}))).status).toBe(401);

    routeState.auth = {
      ...sessionAuth(),
      authType: "apiKey",
      user: null,
    };

    expect((await POST(request({}))).status).toBe(403);
  });

  it("rejects cross-origin session mutations", async () => {
    routeState.auth = sessionAuth();

    const response = await POST(
      request(
        {
          apiKey: "sk-temp",
          providerKind: "OPENAI_COMPATIBLE",
        },
        {
          headers: {
            origin: "https://evil.example",
          },
        },
      ),
    );

    expect(response.status).toBe(403);
  });

  it("uses a transient key to fetch provider model options", async () => {
    routeState.auth = sessionAuth();
    routeState.providerConfigError = new Error("Could not decrypt");

    const response = await POST(
      request({
        apiKey: "sk-temp",
        baseUrl: "https://proxy.example/v1",
        providerKind: "OPENAI_COMPATIBLE",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.models).toEqual([{ id: "model_1", name: "Model 1" }]);
    expect(routeState.providerConfigCalls).toBe(0);
    expect(routeState.listCalls).toEqual([
      expect.objectContaining({
        apiKey: "sk-temp",
        baseUrl: "https://proxy.example/v1",
        providerKind: "OPENAI_COMPATIBLE",
      }),
    ]);
  });

  it("loads saved metadata without decrypting when replacement-key fields are missing", async () => {
    routeState.auth = sessionAuth();
    routeState.providerConfigError = new Error("Could not decrypt");
    routeState.savedMetadata = {
      baseUrl: "https://proxy.example/v1",
      modelId: "model_1",
      providerKind: "OPENAI_COMPATIBLE",
    };

    const response = await POST(request({ apiKey: "sk-temp" }));

    expect(response.status).toBe(200);
    expect(routeState.providerConfigCalls).toBe(0);
    expect(routeState.providerMetadataCalls).toBe(1);
    expect(routeState.listCalls).toEqual([
      expect.objectContaining({
        apiKey: "sk-temp",
        baseUrl: "https://proxy.example/v1",
        providerKind: "OPENAI_COMPATIBLE",
      }),
    ]);
  });

  it("falls back to the saved user credential when no key is submitted", async () => {
    routeState.auth = sessionAuth();
    routeState.savedConfig = {
      apiKey: "sk-saved",
      baseUrl: "https://api.anthropic.com/v1",
      modelId: "claude-sonnet",
      providerKind: "ANTHROPIC_COMPATIBLE",
    };

    await POST(request({}));

    expect(routeState.providerConfigCalls).toBe(1);
    expect(routeState.providerMetadataCalls).toBe(0);
    expect(routeState.listCalls).toEqual([
      expect.objectContaining({
        apiKey: "sk-saved",
        baseUrl: "https://api.anthropic.com/v1",
        providerKind: "ANTHROPIC_COMPATIBLE",
      }),
    ]);
  });
});
