import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    family: {
      id: string;
      name: string;
    };
  },
  db: null as ReturnType<typeof makeDb>["db"] | null,
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => routeState.db),
}));

function makeDb() {
  const db = {
    familyMember: {
      findMany: vi.fn(async () => []),
    },
    householdDocument: {
      findMany: vi.fn(async () => []),
    },
    mealVote: {
      findMany: vi.fn(async () => []),
    },
    pantryStaple: {
      findMany: vi.fn(async () => [
        {
          canonicalName: "olive oil",
          displayName: "Olive Oil",
          id: "staple_1",
        },
      ]),
    },
    rejectedMeal: {
      findMany: vi.fn(async () => []),
    },
    savedRecipe: {
      findMany: vi.fn(async () => [
        {
          costEstimateCents: 1800,
          cuisine: "Mexican",
          id: "recipe_1",
          name: "Turkey Rice Bowls",
          prepTimeTotalMinutes: 40,
          servings: 7,
        },
      ]),
    },
  };

  return { db };
}

describe("GET /api/household-profile", () => {
  beforeEach(() => {
    routeState.auth = {
      family: {
        id: "family_1",
        name: "Test Family",
      },
    };
    routeState.db = makeDb().db;
  });

  it("returns active family pantry staples as additive context", async () => {
    const response = await GET(new Request("http://local.test/api/household-profile"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(routeState.db?.pantryStaple.findMany).toHaveBeenCalledWith({
      orderBy: {
        displayName: "asc",
      },
      select: {
        canonicalName: true,
        displayName: true,
        id: true,
      },
      where: {
        active: true,
        familyId: "family_1",
      },
    });
    expect(body.pantryStaples).toEqual([
      {
        canonicalName: "olive oil",
        displayName: "Olive Oil",
        id: "staple_1",
      },
    ]);
    expect(routeState.db?.savedRecipe.findMany).toHaveBeenCalledWith({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        costEstimateCents: true,
        cuisine: true,
        id: true,
        name: true,
        prepTimeTotalMinutes: true,
        servings: true,
      },
      take: 50,
      where: {
        active: true,
        familyId: "family_1",
      },
    });
    expect(body.savedRecipes).toEqual([
      {
        costEstimateCents: 1800,
        cuisine: "Mexican",
        id: "recipe_1",
        name: "Turkey Rice Bowls",
        prepTimeTotalMinutes: 40,
        servings: 7,
      },
    ]);
  });
});
