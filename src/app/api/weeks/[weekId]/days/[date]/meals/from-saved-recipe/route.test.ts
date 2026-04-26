import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
  },
  result: {
    mealId: "meal_1",
    message: "Replaced dinner for 2026-04-27 from Rice Bowls.",
    weekId: "week_1",
  },
}));

const service = vi.hoisted(() => ({
  replaceDinnerFromSavedRecipeForFamily: vi.fn(async () => routeState.result),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/saved-recipe-api", () => service);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const params = {
  params: Promise.resolve({ date: "2026-04-27", weekId: "week_1" }),
};

describe("POST /api/weeks/[weekId]/days/[date]/meals/from-saved-recipe", () => {
  beforeEach(() => {
    routeState.auth = {
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
    };
    service.replaceDinnerFromSavedRecipeForFamily.mockClear();
  });

  it("replaces a dinner from a saved recipe", async () => {
    const response = await POST(
      new Request(
        "http://local.test/api/weeks/week_1/days/2026-04-27/meals/from-saved-recipe",
        {
          body: JSON.stringify({ recipeId: "recipe_1" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      ),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.replaceDinnerFromSavedRecipeForFamily).toHaveBeenCalledWith({
      dateText: "2026-04-27",
      familyId: "family_1",
      recipeId: "recipe_1",
      weekId: "week_1",
    });
    expect(body).toEqual(routeState.result);
  });
});
