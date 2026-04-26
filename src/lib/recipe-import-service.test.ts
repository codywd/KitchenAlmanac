import { beforeEach, describe, expect, it, vi } from "vitest";

import { importMealPlanForFamily } from "./recipe-import-service";

const serviceState = vi.hoisted(() => ({
  db: null as ReturnType<typeof makeDb>["db"] | null,
}));

vi.mock("./db", () => ({
  getDb: vi.fn(() => serviceState.db),
}));

function recipe(day: string, title: string) {
  return {
    day,
    dinner_title: title,
    ingredients: [{ name: "rice" }],
    instructions: [{ text: "Cook dinner." }],
  };
}

function planWithRecipes(recipes: Array<ReturnType<typeof recipe>>) {
  return {
    recipes,
  };
}

function makeDb() {
  const tx = {
    dayPlan: {
      upsert: vi.fn(async () => ({ id: "day_1" })),
    },
    groceryList: {
      upsert: vi.fn(),
    },
    meal: {
      upsert: vi.fn(async () => ({ id: "meal_1" })),
    },
    week: {
      findUniqueOrThrow: vi.fn(async () => ({
        days: [],
        groceryList: null,
        id: "week_1",
        weekStart: new Date("2026-05-04T00:00:00.000Z"),
      })),
      upsert: vi.fn(async () => ({ id: "week_1" })),
    },
  };
  const db = {
    $transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };

  return { db, tx };
}

describe("importMealPlanForFamily", () => {
  beforeEach(() => {
    serviceState.db = makeDb().db;
  });

  it("rejects duplicate import dates before writing", async () => {
    await expect(
      importMealPlanForFamily({
        familyId: "family_1",
        plan: planWithRecipes([
          recipe("Monday", "First Monday"),
          recipe("Monday", "Second Monday"),
        ]),
        weekStart: new Date("2026-05-04T00:00:00.000Z"),
      }),
    ).rejects.toThrow(/Duplicate Dinner Date/);

    expect(serviceState.db?.$transaction).not.toHaveBeenCalled();
  });

  it("rejects out-of-week import dates before writing", async () => {
    await expect(
      importMealPlanForFamily({
        familyId: "family_1",
        plan: planWithRecipes([
          recipe("Monday", "Monday Dinner"),
          recipe("Tuesday", "Tuesday Dinner"),
          recipe("Wednesday", "Wednesday Dinner"),
          recipe("Thursday", "Thursday Dinner"),
          recipe("Friday", "Friday Dinner"),
          recipe("Saturday", "Saturday Dinner"),
          recipe("Sunday", "Sunday Dinner"),
          recipe("", "Next Monday Dinner"),
        ]),
        weekStart: new Date("2026-05-04T00:00:00.000Z"),
      }),
    ).rejects.toThrow(/Dinner Outside Target Week/);

    expect(serviceState.db?.$transaction).not.toHaveBeenCalled();
  });
});
