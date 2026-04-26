import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveSavedRecipeAction,
  replaceDinnerFromSavedRecipeAction,
  saveMealToRecipeLibraryAction,
  updateSavedRecipeAction,
} from "./recipe-actions";

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

const meal = {
  actualCostCents: 2100,
  batchPrepNote: null,
  budgetFit: true,
  costEstimateCents: 1800,
  cuisine: "Mexican",
  dayPlan: {
    date: new Date("2026-05-05T00:00:00.000Z"),
    week: {
      id: "week_1",
      weekStart: new Date("2026-05-04T00:00:00.000Z"),
    },
    weekId: "week_1",
  },
  diabetesFriendly: false,
  feedbackReason: "Everyone ate it.",
  feedbackStatus: "LIKED",
  feedbackTweaks: null,
  heartHealthy: false,
  id: "meal_1",
  ingredients: [{ item: "ground turkey", quantity: "2 lb" }],
  kidAdaptations: null,
  kidFriendly: true,
  methodSteps: ["Cook dinner."],
  name: "Turkey Rice Bowls",
  noFishSafe: true,
  outcomeStatus: "COOKED",
  prepTimeActiveMinutes: 20,
  prepTimeTotalMinutes: 40,
  servings: 7,
  sourceRecipe: { dinner_title: "Turkey Rice Bowls" },
  validationNotes: null,
  weeknightTimeSafe: true,
};

const savedRecipe = {
  ...meal,
  active: true,
  archivedAt: null,
  archivedByUserId: null,
  createdAt: new Date("2026-05-06T00:00:00.000Z"),
  createdByUserId: "user_owner",
  familyId: "family_1",
  feedbackReason: "Everyone ate it.",
  id: "recipe_1",
  sourceMealDate: new Date("2026-05-05T00:00:00.000Z"),
  sourceMealId: "meal_1",
  sourceMealName: "Turkey Rice Bowls",
  sourceWeekId: "week_1",
  sourceWeekStart: new Date("2026-05-04T00:00:00.000Z"),
  updatedAt: new Date("2026-05-06T00:00:00.000Z"),
  updatedByUserId: "user_owner",
};

function makeDb({
  existingRecipe = undefined as undefined | null | { id: string },
  mealResult = meal as typeof meal | null,
  recipeResult = savedRecipe as typeof savedRecipe | null,
  week = {
    id: "week_2",
    weekStart: new Date("2026-05-11T00:00:00.000Z"),
  } as { id: string; weekStart: Date } | null,
}: {
  existingRecipe?: null | { id: string };
  mealResult?: typeof meal | null;
  recipeResult?: typeof savedRecipe | null;
  week?: { id: string; weekStart: Date } | null;
} = {}) {
  const tx = {
    dayPlan: {
      upsert: vi.fn(async () => ({ id: "day_1" })),
    },
    meal: {
      create: vi.fn(async () => ({ id: "meal_new" })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const db = {
    $transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    meal: {
      findFirst: vi.fn(async () => mealResult),
    },
    savedRecipe: {
      create: vi.fn(async () => ({ id: "recipe_1", name: "Turkey Rice Bowls" })),
      findFirst: vi.fn(async (args: { where?: { sourceMealId?: string } }) =>
        args.where?.sourceMealId ? existingRecipe ?? null : recipeResult,
      ),
      update: vi.fn(async () => ({ id: "recipe_1", name: "Turkey Rice Bowls" })),
      updateMany: vi.fn(async () => ({ count: recipeResult ? 1 : 0 })),
    },
    week: {
      findFirst: vi.fn(async () => week),
    },
  };

  return { db, tx };
}

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

describe("recipe library actions", () => {
  beforeEach(() => {
    actionState.context.role = "OWNER";
    actionState.db = makeDb().db;
    actionState.revalidated = [];
  });

  it("lets owners save an in-family meal to the recipe library", async () => {
    const { db } = makeDb({ existingRecipe: null });
    actionState.db = db;

    const result = await saveMealToRecipeLibraryAction(
      formData({ mealId: "meal_1" }),
    );

    expect(db.meal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dayPlan: {
            week: {
              familyId: "family_1",
            },
          },
          id: "meal_1",
        },
      }),
    );
    expect(db.savedRecipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        active: true,
        familyId: "family_1",
        name: "Turkey Rice Bowls",
        sourceMealId: "meal_1",
      }),
    });
    expect(result).toEqual({
      message: "Saved Turkey Rice Bowls to the recipe library.",
      recipeId: "recipe_1",
    });
    expect(actionState.revalidated).toEqual(
      expect.arrayContaining(["/meal-memory", "/planner", "/recipes"]),
    );
  });

  it("updates the existing saved recipe instead of duplicating a source meal", async () => {
    const { db } = makeDb({ existingRecipe: { id: "recipe_existing" } });
    actionState.db = db;

    const result = await saveMealToRecipeLibraryAction(
      formData({ mealId: "meal_1" }),
    );

    expect(db.savedRecipe.create).not.toHaveBeenCalled();
    expect(db.savedRecipe.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        active: true,
        archivedAt: null,
        archivedByUserId: null,
        name: "Turkey Rice Bowls",
      }),
      where: {
        id: "recipe_existing",
      },
    });
    expect(result.recipeId).toBe("recipe_existing");
  });

  it("forbids members from mutating the recipe library", async () => {
    actionState.context.role = "MEMBER";

    await expect(
      saveMealToRecipeLibraryAction(formData({ mealId: "meal_1" })),
    ).rejects.toThrow("Only family owners and admins can manage meal plans.");
  });

  it("updates recipe details within the current family", async () => {
    const { db } = makeDb();
    actionState.db = db;

    const result = await updateSavedRecipeAction(
      {},
      formData({
        active: "on",
        budgetFit: "on",
        costEstimateDollars: "22.50",
        cuisine: "Tex-Mex",
        diabetesFriendly: "",
        heartHealthy: "",
        ingredientsJson: JSON.stringify([{ item: "ground turkey", quantity: "2 lb" }]),
        kidFriendly: "on",
        methodStepsText: "Cook turkey.\nServe bowls.",
        name: "Better Turkey Bowls",
        noFishSafe: "on",
        prepTimeActiveMinutes: "20",
        prepTimeTotalMinutes: "40",
        recipeId: "recipe_1",
        servings: "7",
        weeknightTimeSafe: "on",
      }),
    );

    expect(db.savedRecipe.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        costEstimateCents: 2250,
        cuisine: "Tex-Mex",
        ingredients: [{ item: "ground turkey", quantity: "2 lb" }],
        methodSteps: ["Cook turkey.", "Serve bowls."],
        name: "Better Turkey Bowls",
        updatedByUserId: "user_owner",
      }),
      where: {
        id: "recipe_1",
      },
    });
    expect(result).toEqual({
      message: "Updated Better Turkey Bowls.",
      recipeId: "recipe_1",
    });
  });

  it("archives and unarchives recipes within the current family", async () => {
    const { db } = makeDb();
    actionState.db = db;

    await archiveSavedRecipeAction(
      formData({ active: "false", recipeId: "recipe_1" }),
    );
    await archiveSavedRecipeAction(
      formData({ active: "true", recipeId: "recipe_1" }),
    );

    expect(db.savedRecipe.updateMany).toHaveBeenNthCalledWith(1, {
      data: {
        active: false,
        archivedAt: expect.any(Date),
        archivedByUserId: "user_owner",
        updatedByUserId: "user_owner",
      },
      where: {
        familyId: "family_1",
        id: "recipe_1",
      },
    });
    expect(db.savedRecipe.updateMany).toHaveBeenNthCalledWith(2, {
      data: {
        active: true,
        archivedAt: null,
        archivedByUserId: null,
        updatedByUserId: "user_owner",
      },
      where: {
        familyId: "family_1",
        id: "recipe_1",
      },
    });
  });

  it("replaces a week dinner from a saved recipe and resets meal state", async () => {
    const { db, tx } = makeDb();
    actionState.db = db;

    const result = await replaceDinnerFromSavedRecipeAction(
      {},
      formData({
        date: "2026-05-13",
        recipeId: "recipe_1",
        weekId: "week_2",
      }),
    );

    expect(result).toEqual({
      mealId: "meal_new",
      message:
        "Replaced dinner for 2026-05-13 from Turkey Rice Bowls. Ingredient rollup updated; stored grocery list may need refresh.",
      weekId: "week_2",
    });
    expect(tx.meal.deleteMany).toHaveBeenCalledWith({
      where: {
        dayPlanId: "day_1",
      },
    });
    expect(tx.meal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actualCostCents: null,
          dayPlanId: "day_1",
          feedbackStatus: "PLANNED",
          name: "Turkey Rice Bowls",
          outcomeStatus: "PLANNED",
        }),
      }),
    );
    expect(actionState.revalidated).toEqual(
      expect.arrayContaining([
        "/calendar",
        "/ingredients",
        "/meal-memory",
        "/recipes",
        "/weeks/week_2",
        "/weeks/week_2/review",
      ]),
    );
  });
});
