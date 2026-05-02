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
  chatCalls: [] as unknown[],
  context: null as null | {
    household: {
      activeRejectedMeals: unknown[];
      householdDocuments: unknown[];
      pantryStaples: unknown[];
      recentMeals: unknown[];
      recentVotes: unknown[];
      savedRecipes: unknown[];
    };
    recipe: {
      costLabel: string;
      dateLabel: string;
      equipment: string[];
      health: {
        changes: string[];
        whyItHelps: string[];
      };
      ingredients: unknown[];
      kid: {
        notes: string[];
      };
      leftovers: {
        reuseIdeas: string[];
      };
      nutrition: unknown[];
      servingNotes: string[];
      servings: number;
      steps: unknown[];
      title: string;
      validationFlags: unknown[];
    };
  },
  markedUsed: [] as string[],
  savedConfig: null as null | {
    apiKey: string;
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
    sendLlmChat: vi.fn(async (input: unknown) => {
      routeState.chatCalls.push(input);

      return { text: "Reduce the salt and add lemon at the end." };
    }),
  };
});

vi.mock("@/lib/llm-settings", () => ({
  getUserLlmProviderConfig: vi.fn(async () => routeState.savedConfig),
  markUserLlmSettingsUsed: vi.fn(async (userId: string) => {
    routeState.markedUsed.push(userId);
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

vi.mock("@/lib/recipe-chat-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/recipe-chat-context")>(
    "@/lib/recipe-chat-context",
  );

  return {
    ...actual,
    loadRecipeChatContext: vi.fn(async () => routeState.context),
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
  return new Request("https://meals.example/api/llm/chat", {
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

describe("POST /api/llm/chat", () => {
  beforeEach(() => {
    routeState.auth = null;
    routeState.chatCalls = [];
    routeState.context = {
      household: {
        activeRejectedMeals: [],
        householdDocuments: [],
        pantryStaples: [],
        recentMeals: [],
        recentVotes: [],
        savedRecipes: [],
      },
      recipe: {
        costLabel: "$18",
        dateLabel: "Tuesday",
        equipment: [],
        health: {
          changes: ["Use less salt."],
          whyItHelps: [],
        },
        ingredients: [],
        kid: {
          notes: [],
        },
        leftovers: {
          reuseIdeas: [],
        },
        nutrition: [],
        servingNotes: [],
        servings: 6,
        steps: [],
        title: "Chicken Fajitas",
        validationFlags: [],
      },
    };
    routeState.markedUsed = [];
    routeState.savedConfig = {
      apiKey: "sk-saved",
      baseUrl: "https://api.openai.com/v1",
      modelId: "gpt-5.4-mini",
      providerKind: "OPENAI_COMPATIBLE",
    };
  });

  it("requires a signed-in user session", async () => {
    expect(
      (await POST(request({ mealId: "meal_1", messages: [] }))).status,
    ).toBe(401);
  });

  it("requires saved user LLM settings", async () => {
    routeState.auth = sessionAuth();
    routeState.savedConfig = null;

    const response = await POST(
      request({
        mealId: "meal_1",
        messages: [{ content: "Help?", role: "user" }],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("LLM provider");
  });

  it("returns 404 when the meal is outside the user's family", async () => {
    routeState.auth = sessionAuth();
    routeState.context = null;

    const response = await POST(
      request({
        mealId: "meal_other",
        messages: [{ content: "Help?", role: "user" }],
      }),
    );

    expect(response.status).toBe(404);
  });

  it("sends scoped recipe context and session chat history to the provider", async () => {
    routeState.auth = sessionAuth();

    const response = await POST(
      request({
        mealId: "meal_1",
        messages: [{ content: "How should I adapt this?", role: "user" }],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reply).toBe("Reduce the salt and add lemon at the end.");
    expect(routeState.chatCalls).toEqual([
      expect.objectContaining({
        apiKey: "sk-saved",
        messages: [{ content: "How should I adapt this?", role: "user" }],
        modelId: "gpt-5.4-mini",
        providerKind: "OPENAI_COMPATIBLE",
        systemPrompt: expect.stringContaining("Chicken Fajitas"),
      }),
    ]);
    expect(routeState.markedUsed).toEqual(["user_1"]);
  });
});
