import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    actorUserId?: string;
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
    user: null | { id: string };
  },
  recipe: { active: false, familyId: "family_1", id: "recipe_1", name: "Rice Bowls" },
}));

const service = vi.hoisted(() => ({
  getSavedRecipeForFamily: vi.fn(async () => routeState.recipe),
  updateSavedRecipeForFamily: vi.fn(async () => routeState.recipe),
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

vi.mock("@/lib/saved-recipe-api", () => service);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const params = { params: Promise.resolve({ recipeId: "recipe_1" }) };

function request(body: unknown) {
  return new Request("http://local.test/api/saved-recipes/recipe_1", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
}

describe("saved recipe item API", () => {
  beforeEach(() => {
    routeState.auth = {
      actorUserId: "user_key_creator",
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
      user: null,
    };
    service.getSavedRecipeForFamily.mockClear();
    service.updateSavedRecipeForFamily.mockClear();
  });

  it("gets full saved recipe details", async () => {
    const response = await GET(
      new Request("http://local.test/api/saved-recipes/recipe_1"),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.getSavedRecipeForFamily).toHaveBeenCalledWith({
      familyId: "family_1",
      recipeId: "recipe_1",
    });
    expect(body.savedRecipe).toEqual(routeState.recipe);
  });

  it("patches saved recipes with actor audit fields", async () => {
    const response = await PATCH(request({ active: false }), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.updateSavedRecipeForFamily).toHaveBeenCalledWith({
      familyId: "family_1",
      payload: { active: false },
      recipeId: "recipe_1",
      userId: "user_key_creator",
    });
    expect(body.savedRecipe).toEqual(routeState.recipe);
  });
});
