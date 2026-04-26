import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRejectedMealAction, replaceDinnerFromRecipeAction } from "./meal-actions";

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

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

function makeDb({
  week = {
    budgetTargetCents: 35000,
    id: "week_1",
    weekStart: new Date("2026-05-04T00:00:00.000Z"),
  },
} = {}) {
  const tx = {
    dayPlan: {
      upsert: vi.fn(async () => ({
        id: "day_1",
      })),
    },
    meal: {
      create: vi.fn(async () => ({
        id: "meal_new",
      })),
      deleteMany: vi.fn(async () => ({
        count: 1,
      })),
    },
  };
  const db = {
    $transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    rejectedMeal: {
      create: vi.fn(async () => ({
        id: "rejected_1",
      })),
    },
    week: {
      findFirst: vi.fn(async () => week),
    },
  };

  return { db, tx };
}

function formData(overrides: Record<string, string> = {}) {
  const data = new FormData();

  data.set("date", "2026-05-06");
  data.set(
    "recipeJson",
    JSON.stringify({
      dinner_title: "Lemon Chicken Rice Bowls",
      estimated_cost_usd: 24,
      ingredients: [{ amount: 2, name: "chicken breast", unit: "lb" }],
      instructions: [{ step: 1, text: "Cook dinner." }],
      time: { prep_minutes: 20, total_minutes: 40 },
    }),
  );
  data.set("weekId", "week_1");

  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }

  return data;
}

describe("replaceDinnerFromRecipeAction", () => {
  beforeEach(() => {
    actionState.context.role = "OWNER";
    actionState.db = makeDb().db;
    actionState.revalidated = [];
  });

  it("forbids member users from replacing dinners", async () => {
    actionState.context.role = "MEMBER";

    await expect(
      replaceDinnerFromRecipeAction({}, formData()),
    ).rejects.toThrow("Only family owners and admins can manage meal plans.");
  });

  it("returns an error for invalid recipe JSON", async () => {
    const result = await replaceDinnerFromRecipeAction(
      {},
      formData({ recipeJson: "{not json" }),
    );

    expect(result.error).toBe("Could not parse the replacement recipe JSON.");
  });

  it("rejects weeks outside the current family", async () => {
    actionState.db = makeDb({ week: null }).db;

    const result = await replaceDinnerFromRecipeAction({}, formData());

    expect(result.error).toBe("Week not found.");
  });

  it("rejects replacement dates outside the selected week", async () => {
    const result = await replaceDinnerFromRecipeAction(
      {},
      formData({ date: "2026-05-11" }),
    );

    expect(result.error).toBe("Replacement date must be inside the selected week.");
  });

  it("deletes the old meal and creates a fresh planned meal for that day", async () => {
    const { db, tx } = makeDb();
    actionState.db = db;

    const result = await replaceDinnerFromRecipeAction({}, formData());

    expect(result).toMatchObject({
      mealId: "meal_new",
      message:
        "Replaced dinner for 2026-05-06. Ingredient rollup updated; stored grocery list may need refresh.",
      weekId: "week_1",
    });
    expect(tx.dayPlan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          date: new Date("2026-05-06T00:00:00.000Z"),
          weekId: "week_1",
        },
      }),
    );
    expect(tx.meal.deleteMany).toHaveBeenCalledWith({
      where: {
        dayPlanId: "day_1",
      },
    });
    expect(tx.meal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dayPlanId: "day_1",
          feedbackReason: null,
          feedbackStatus: "PLANNED",
          feedbackTweaks: null,
          name: "Lemon Chicken Rice Bowls",
        }),
      }),
    );
    expect(actionState.revalidated).toEqual(
      expect.arrayContaining([
        "/calendar",
        "/ingredients",
        "/meal-memory",
        "/weeks/week_1",
        "/weeks/week_1/review",
      ]),
    );
  });
});

describe("createRejectedMealAction", () => {
  beforeEach(() => {
    actionState.context.role = "OWNER";
    actionState.db = makeDb().db;
    actionState.revalidated = [];
  });

  it("rejects blank tampered submissions before writing", async () => {
    await expect(
      createRejectedMealAction(
        formData({
          mealName: "   ",
          patternToAvoid: "   ",
          reason: "   ",
        }),
      ),
    ).rejects.toThrow("Enter a meal name, reason, and pattern to avoid.");

    expect(actionState.db?.rejectedMeal.create).not.toHaveBeenCalled();
  });

  it("persists valid rejected meal submissions with trimmed values", async () => {
    await createRejectedMealAction(
      formData({
        mealName: "  Fish Tacos  ",
        patternToAvoid: "  fish-forward dinners  ",
        reason: "  Allergy constraint  ",
      }),
    );

    expect(actionState.db?.rejectedMeal.create).toHaveBeenCalledWith({
      data: {
        active: true,
        createdByUserId: "user_owner",
        familyId: "family_1",
        mealName: "Fish Tacos",
        patternToAvoid: "fish-forward dinners",
        reason: "Allergy constraint",
      },
    });
    expect(actionState.revalidated).toEqual(
      expect.arrayContaining(["/rejected-meals", "/meal-memory"]),
    );
  });
});
