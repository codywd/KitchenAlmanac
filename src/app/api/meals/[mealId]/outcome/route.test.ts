import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    actorUserId?: string;
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
    user: null | { id: string };
  },
  result: {
    meal: { id: "meal_1", name: "Rice Bowls" },
    rejectedMeal: null,
    weekId: "week_1",
  },
}));

const service = vi.hoisted(() => ({
  saveMealOutcomeForFamily: vi.fn(async () => routeState.result),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
  getAuthenticatedActorUserId: vi.fn((auth: typeof routeState.auth) =>
    auth?.actorUserId ?? auth?.user?.id ?? null,
  ),
}));

vi.mock("@/lib/meal-outcomes-api", () => service);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const params = { params: Promise.resolve({ mealId: "meal_1" }) };

function request(body: unknown) {
  return new Request("http://local.test/api/meals/meal_1/outcome", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("POST /api/meals/[mealId]/outcome", () => {
  beforeEach(() => {
    routeState.auth = {
      actorUserId: "user_key_creator",
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
      user: null,
    };
    service.saveMealOutcomeForFamily.mockClear();
  });

  it("saves meal closeout with API-key creator attribution", async () => {
    const response = await POST(
      request({
        actualCostCents: 1875,
        feedbackStatus: "LIKED",
        outcomeStatus: "COOKED",
      }),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.saveMealOutcomeForFamily).toHaveBeenCalledWith({
      familyId: "family_1",
      mealId: "meal_1",
      payload: expect.objectContaining({
        actualCostCents: 1875,
        feedbackStatus: "LIKED",
        outcomeStatus: "COOKED",
      }),
      userId: "user_key_creator",
    });
    expect(body).toEqual(routeState.result);
  });
});
