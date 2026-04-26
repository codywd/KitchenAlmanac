import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveMealOutcomeAction } from "./closeout-actions";

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

function makeDb({
  meal = {
    dayPlan: {
      weekId: "week_1",
    },
    id: "meal_1",
    name: "Turkey Bowls",
  },
} = {}) {
  const db = {
    meal: {
      findFirst: vi.fn(async () => meal),
      update: vi.fn(async () => meal),
    },
    rejectedMeal: {
      create: vi.fn(async () => ({
        id: "rejected_1",
      })),
    },
  };

  return { db };
}

function formData(overrides: Record<string, string> = {}) {
  const data = new FormData();

  data.set("actualCostDollars", "18.75");
  data.set("feedbackReason", "Everyone liked it.");
  data.set("feedbackStatus", "LIKED");
  data.set("feedbackTweaks", "Use a little less rice.");
  data.set("leftoverNotes", "Two lunches packed.");
  data.set("mealId", "meal_1");
  data.set("outcomeNotes", "Cooked on Monday.");
  data.set("outcomeStatus", "COOKED");
  data.set("weekId", "week_1");

  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }

  return data;
}

describe("saveMealOutcomeAction", () => {
  beforeEach(() => {
    actionState.context.role = "OWNER";
    actionState.db = makeDb().db;
    actionState.revalidated = [];
  });

  it("forbids member users from saving closeout outcomes", async () => {
    actionState.context.role = "MEMBER";

    await expect(
      saveMealOutcomeAction({}, formData()),
    ).rejects.toThrow("Only family owners and admins can manage meal plans.");
  });

  it("returns an error when the meal is not in the current family week", async () => {
    actionState.db = makeDb({ meal: null }).db;

    const result = await saveMealOutcomeAction({}, formData());

    expect(result.error).toBe("Meal not found.");
  });

  it("rejects invalid actual cost values", async () => {
    const result = await saveMealOutcomeAction(
      {},
      formData({ actualCostDollars: "-4" }),
    );

    expect(result.error).toBe("Actual cost must be a positive dollar amount.");
  });

  it("saves the meal outcome and revalidates closeout and memory surfaces", async () => {
    const { db } = makeDb();
    actionState.db = db;

    const result = await saveMealOutcomeAction({}, formData());

    expect(result).toEqual({
      message: "Saved closeout for Turkey Bowls.",
      mealId: "meal_1",
      weekId: "week_1",
    });
    expect(db.meal.findFirst).toHaveBeenCalledWith({
      include: {
        dayPlan: {
          select: {
            weekId: true,
          },
        },
      },
      where: {
        dayPlan: {
          week: {
            familyId: "family_1",
            id: "week_1",
          },
        },
        id: "meal_1",
      },
    });
    expect(db.meal.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actualCostCents: 1875,
        closedOutByUserId: "user_owner",
        feedbackReason: "Everyone liked it.",
        feedbackStatus: "LIKED",
        feedbackTweaks: "Use a little less rice.",
        leftoverNotes: "Two lunches packed.",
        outcomeNotes: "Cooked on Monday.",
        outcomeStatus: "COOKED",
      }),
      where: {
        id: "meal_1",
      },
    });
    expect(actionState.revalidated).toEqual(
      expect.arrayContaining([
        "/calendar",
        "/meal-memory",
        "/planner",
        "/weeks/week_1",
        "/weeks/week_1/closeout",
        "/weeks/week_1/review",
      ]),
    );
  });

  it("can create a rejected-meal pattern from rejected closeout feedback", async () => {
    const { db } = makeDb();
    actionState.db = db;

    await saveMealOutcomeAction(
      {},
      formData({
        createRejectedPattern: "on",
        feedbackReason: "Too spicy.",
        feedbackStatus: "REJECTED",
        patternToAvoid: "spicy rice bowls",
      }),
    );

    expect(db.rejectedMeal.create).toHaveBeenCalledWith({
      data: {
        createdByUserId: "user_owner",
        familyId: "family_1",
        mealName: "Turkey Bowls",
        patternToAvoid: "spicy rice bowls",
        reason: "Too spicy.",
        sourceMealId: "meal_1",
      },
    });
  });
});
