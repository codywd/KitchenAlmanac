import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    actorUserId?: string;
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
    user: null | { id: string };
  },
  recipes: [{ active: true, familyId: "family_1", id: "recipe_1", name: "Rice Bowls" }],
}));

const service = vi.hoisted(() => ({
  createSavedRecipeForFamily: vi.fn(async () => routeState.recipes[0]),
  listSavedRecipesForFamily: vi.fn(async () => routeState.recipes),
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
  return new Request("http://local.test/api/saved-recipes", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("saved recipe collection API", () => {
  beforeEach(() => {
    routeState.auth = {
      actorUserId: "user_key_creator",
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
      user: null,
    };
    service.createSavedRecipeForFamily.mockClear();
    service.listSavedRecipesForFamily.mockClear();
  });

  it("lists saved recipes with active filter", async () => {
    const response = await GET(new Request("http://local.test/api/saved-recipes?active=all"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.listSavedRecipesForFamily).toHaveBeenCalledWith({
      active: "all",
      familyId: "family_1",
    });
    expect(body.savedRecipes).toEqual(routeState.recipes);
  });

  it("requires key creator attribution to create saved recipes", async () => {
    routeState.auth = {
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
      user: null,
    };

    const response = await POST(request({ name: "Rice Bowls" }));

    expect(response.status).toBe(403);
  });

  it("creates a saved recipe from JSON fields", async () => {
    const response = await POST(
      request({
        ingredients: [{ item: "Rice" }],
        methodSteps: ["Cook."],
        name: "Rice Bowls",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(service.createSavedRecipeForFamily).toHaveBeenCalledWith({
      familyId: "family_1",
      payload: expect.objectContaining({ name: "Rice Bowls" }),
      userId: "user_key_creator",
    });
    expect(body.savedRecipe).toEqual(routeState.recipes[0]);
  });
});
