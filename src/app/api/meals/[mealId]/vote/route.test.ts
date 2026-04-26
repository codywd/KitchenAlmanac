import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    actorUserId?: string;
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
    user: null | { id: string };
  },
  vote: { comment: "Yes", mealId: "meal_1", userId: "user_key_creator", vote: "WANT" },
}));

const service = vi.hoisted(() => ({
  upsertMealVoteForFamily: vi.fn(async () => routeState.vote),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
  getAuthenticatedActorUserId: vi.fn((auth: typeof routeState.auth) =>
    auth?.actorUserId ?? auth?.user?.id ?? null,
  ),
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );

  return {
    ...actual,
    assertRateLimit: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/meal-votes-api", () => service);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const params = { params: Promise.resolve({ mealId: "meal_1" }) };

describe("POST /api/meals/[mealId]/vote", () => {
  beforeEach(() => {
    routeState.auth = {
      actorUserId: "user_key_creator",
      family: { id: "family_1", name: "Test Family" },
      role: "MEMBER",
      user: null,
    };
    service.upsertMealVoteForFamily.mockClear();
  });

  it("upserts the key creator or session user's vote", async () => {
    const response = await POST(
      new Request("http://local.test/api/meals/meal_1/vote", {
        body: JSON.stringify({ comment: "Yes", vote: "WANT" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.upsertMealVoteForFamily).toHaveBeenCalledWith({
      familyId: "family_1",
      payload: { comment: "Yes", mealId: "meal_1", vote: "WANT" },
      userId: "user_key_creator",
    });
    expect(body.mealVote).toEqual(routeState.vote);
  });
});
