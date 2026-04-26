import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    actorUserId?: string;
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
    user: null | { id: string };
  },
  result: { message: "Saved Rice Bowls.", recipeId: "recipe_1" },
}));

const service = vi.hoisted(() => ({
  saveMealToRecipeLibraryForFamily: vi.fn(async () => routeState.result),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
  getAuthenticatedActorUserId: vi.fn((auth: typeof routeState.auth) =>
    auth?.actorUserId ?? auth?.user?.id ?? null,
  ),
}));

vi.mock("@/lib/saved-recipe-api", () => service);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function request(body: unknown) {
  return new Request("http://local.test/api/saved-recipes/from-meal", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("POST /api/saved-recipes/from-meal", () => {
  beforeEach(() => {
    routeState.auth = {
      actorUserId: "user_key_creator",
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
      user: null,
    };
    service.saveMealToRecipeLibraryForFamily.mockClear();
  });

  it("saves an existing meal into the recipe library", async () => {
    const response = await POST(request({ mealId: "meal_1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.saveMealToRecipeLibraryForFamily).toHaveBeenCalledWith({
      familyId: "family_1",
      mealId: "meal_1",
      userId: "user_key_creator",
    });
    expect(body).toEqual(routeState.result);
  });
});
