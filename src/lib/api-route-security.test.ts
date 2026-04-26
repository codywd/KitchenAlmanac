import { beforeEach, describe, expect, it, vi } from "vitest";

const routeSecurityState = vi.hoisted(() => ({
  rateLimitCalls: [] as unknown[],
}));

vi.mock("./rate-limit", async () => {
  const actual = await vi.importActual<typeof import("./rate-limit")>(
    "./rate-limit",
  );

  return {
    ...actual,
    assertRateLimit: vi.fn(async (input: unknown) => {
      routeSecurityState.rateLimitCalls.push(input);
    }),
  };
});

import { secureMutationRequest } from "./api-route-security";
import { rateLimitPolicies } from "./rate-limit";

describe("API route security", () => {
  beforeEach(() => {
    routeSecurityState.rateLimitCalls = [];
  });

  it("lets API-key automation bypass same-origin checks but still rate-limits", async () => {
    const response = await secureMutationRequest({
      auth: {
        actorUserId: "user_1",
        authType: "apiKey",
        family: {
          id: "family_1",
          name: "Test Family",
        },
        role: "ADMIN",
        user: null,
      },
      rateLimit: {
        policy: rateLimitPolicies.planningWrite,
        scope: "planning-write-api",
        subject: "family_1:user_1",
      },
      request: new Request("https://meals.example/api/weeks", {
        headers: {
          authorization: "Bearer mp_secret",
          origin: "https://automation.example",
        },
        method: "POST",
      }),
    });

    expect(response).toBeNull();
    expect(routeSecurityState.rateLimitCalls).toEqual([
      expect.objectContaining({
        familyId: "family_1",
        scope: "planning-write-api",
        subject: "family_1:user_1",
      }),
    ]);
  });
});
