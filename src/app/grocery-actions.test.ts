import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshGroceryListFromCurrentMealsAction } from "./grocery-actions";

const actionState = vi.hoisted(() => ({
  context: {
    family: {
      id: "family_1",
      name: "Test Family",
    },
    role: "OWNER" as "ADMIN" | "MEMBER" | "OWNER",
    user: {
      email: "owner@example.local",
      id: "user_owner",
      name: "Owner",
    },
  },
  db: null as ReturnType<typeof makeDb>["db"] | null,
  revalidated: [] as string[],
}));

vi.mock("@/lib/family", async () => {
  const actual = await vi.importActual<typeof import("@/lib/family")>(
    "@/lib/family",
  );

  return {
    ...actual,
    requireFamilyContext: vi.fn(async () => actionState.context),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => actionState.db),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((path: string) => actionState.revalidated.push(path)),
}));

const defaultWeek = {
  days: [
    {
      date: new Date("2026-05-04T00:00:00.000Z"),
      dinner: {
        ingredients: [
          { item: "chicken breasts", quantity: "2 lb" },
          { item: "olive oil", pantryItem: true, quantity: "2 tbsp" },
        ],
        name: "Lemon Chicken",
      },
    },
  ],
  groceryList: {
    id: "grocery_1",
  },
  id: "week_1",
};

function makeDb({
  week = defaultWeek as typeof defaultWeek | null,
}: {
  week?: typeof defaultWeek | null;
} = {}) {
  const db = {
    groceryList: {
      upsert: vi.fn(async (args: unknown) => ({
        id: "grocery_1",
        args,
      })),
    },
    pantryStaple: {
      findMany: vi.fn(async () => []),
    },
    week: {
      findFirst: vi.fn(async () => week),
    },
  };

  return { db };
}

function formData(overrides: Record<string, string> = {}) {
  const data = new FormData();

  data.set("weekId", "week_1");

  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }

  return data;
}

describe("refreshGroceryListFromCurrentMealsAction", () => {
  beforeEach(() => {
    actionState.context.role = "OWNER";
    actionState.db = makeDb().db;
    actionState.revalidated = [];
  });

  it("refreshes a family week grocery list from current meal ingredients for admins", async () => {
    actionState.context.role = "ADMIN";
    const db = makeDb().db;
    actionState.db = db;

    const result = await refreshGroceryListFromCurrentMealsAction(
      {},
      formData(),
    );

    expect(db.week.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyId: "family_1",
          id: "week_1",
        },
      }),
    );
    expect(db.groceryList.upsert).toHaveBeenCalledWith({
      create: {
        notes: "Refreshed from current planned dinners.",
        sections: [
          {
            items: [
              {
                item: "chicken breast",
                pantryItem: false,
                quantity: "2 pound",
                usedInRecipes: ["Lemon Chicken"],
              },
            ],
            name: "To buy",
          },
          {
            items: [
              {
                item: "olive oil",
                pantryItem: true,
                quantity: "2 tablespoon",
                usedInRecipes: ["Lemon Chicken"],
              },
            ],
            name: "Pantry / on hand",
          },
        ],
        weekId: "week_1",
      },
      update: {
        notes: "Refreshed from current planned dinners.",
        sections: [
          {
            items: [
              {
                item: "chicken breast",
                pantryItem: false,
                quantity: "2 pound",
                usedInRecipes: ["Lemon Chicken"],
              },
            ],
            name: "To buy",
          },
          {
            items: [
              {
                item: "olive oil",
                pantryItem: true,
                quantity: "2 tablespoon",
                usedInRecipes: ["Lemon Chicken"],
              },
            ],
            name: "Pantry / on hand",
          },
        ],
      },
      where: {
        weekId: "week_1",
      },
    });
    expect(actionState.revalidated).toEqual([
      "/ingredients",
      "/weeks/week_1",
      "/weeks/week_1/review",
    ]);
    expect(result).toEqual({
      message: "Refreshed grocery list from 2 current ingredients.",
      weekId: "week_1",
    });
  });

  it("forbids member users from refreshing grocery lists", async () => {
    actionState.context.role = "MEMBER";

    await expect(
      refreshGroceryListFromCurrentMealsAction({}, formData()),
    ).rejects.toThrow("Only family owners and admins can manage meal plans.");
  });

  it("rejects weeks outside the current family", async () => {
    actionState.db = makeDb({ week: null }).db;

    const result = await refreshGroceryListFromCurrentMealsAction(
      {},
      formData(),
    );

    expect(result.error).toBe("Week not found.");
  });

  it("does not overwrite an existing grocery list when current meals have no ingredients", async () => {
    const db = makeDb({
      week: {
        ...defaultWeek,
        days: [
          {
            date: new Date("2026-05-04T00:00:00.000Z"),
            dinner: {
              ingredients: [],
              name: "Mystery Dinner",
            },
          },
        ],
      },
    }).db;
    actionState.db = db;

    const result = await refreshGroceryListFromCurrentMealsAction(
      {},
      formData(),
    );

    expect(result.error).toBe(
      "This week has no meal ingredients to refresh from.",
    );
    expect(db.groceryList.upsert).not.toHaveBeenCalled();
  });
});
