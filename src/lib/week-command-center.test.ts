import { describe, expect, it } from "vitest";

import {
  buildWeekCommandCenterView,
  type WeekCommandCenterMeal,
  type WeekCommandCenterView,
  type WeekCommandCenterWeek,
} from "./week-command-center";

function stage(view: WeekCommandCenterView, id: string) {
  const match = view.stages.find((item) => item.id === id);

  if (!match) {
    throw new Error(`Missing stage ${id}.`);
  }

  return match;
}

function meal(overrides: Partial<WeekCommandCenterMeal> = {}): WeekCommandCenterMeal {
  return {
    actualCostCents: null,
    budgetFit: true,
    costEstimateCents: 1200,
    cuisine: "Mexican",
    diabetesFriendly: true,
    feedbackReason: null,
    feedbackStatus: "PLANNED",
    feedbackTweaks: null,
    heartHealthy: true,
    id: "meal_1",
    ingredients: [{ item: "Brown rice", quantity: "2 cups" }],
    kidFriendly: true,
    leftoverNotes: null,
    name: "Turkey Bowls",
    noFishSafe: true,
    outcomeNotes: null,
    outcomeStatus: "PLANNED",
    searchText: "turkey bowls brown rice",
    servings: 6,
    sourceRecipe: {},
    votes: [],
    weeknightTimeSafe: true,
    ...overrides,
  };
}

function week(overrides: Partial<WeekCommandCenterWeek> = {}): WeekCommandCenterWeek {
  return {
    budgetTargetCents: 5000,
    days: [
      {
        date: new Date("2026-05-04T00:00:00.000Z"),
        dinner: meal(),
      },
    ],
    groceryList: null,
    id: "week_1",
    shoppingItemStates: [],
    title: null,
    weekStart: new Date("2026-05-04T00:00:00.000Z"),
    ...overrides,
  };
}

function viewFor({
  selectedWeek,
  today = new Date("2026-05-04T00:00:00.000Z"),
}: {
  selectedWeek: WeekCommandCenterWeek | null;
  today?: Date;
}) {
  return buildWeekCommandCenterView({
    activeRejectedMeals: [],
    canManage: true,
    pantryStaples: [],
    relatedWeeks: [],
    selectedWeek,
    today,
  });
}

describe("week command center", () => {
  it("shows a planning launch state when no weeks exist", () => {
    const view = viewFor({ selectedWeek: null });

    expect(view.selectedWeek).toBeNull();
    expect(stage(view, "plan")).toMatchObject({
      actionHref: "/planner",
      status: "attention",
    });
    expect(stage(view, "review").status).toBe("blocked");
    expect(view.nextAction).toMatchObject({
      href: "/planner",
      stageId: "plan",
    });
  });

  it("summarizes a partial week with missing dinners as review attention", () => {
    const view = viewFor({ selectedWeek: week() });

    expect(view.stats).toMatchObject({
      missingDinners: 6,
      plannedDinners: 1,
    });
    expect(stage(view, "plan").status).toBe("done");
    expect(stage(view, "review")).toMatchObject({
      status: "attention",
    });
    expect(view.review.warningCount).toBeGreaterThan(0);
  });

  it("surfaces review warnings from rejected meal patterns", () => {
    const view = buildWeekCommandCenterView({
      activeRejectedMeals: [
        {
          mealName: "Fish Tacos",
          patternToAvoid: "fish tacos",
          reason: "Household avoids fish.",
        },
      ],
      canManage: true,
      pantryStaples: [],
      relatedWeeks: [],
      selectedWeek: week({
        days: [
          {
            date: new Date("2026-05-04T00:00:00.000Z"),
            dinner: meal({
              id: "meal_fish",
              ingredients: [{ item: "Tilapia", quantity: "2 lb" }],
              name: "Fish Tacos",
              noFishSafe: false,
              searchText: "fish tacos tilapia",
            }),
          },
        ],
      }),
      today: new Date("2026-05-04T00:00:00.000Z"),
    });

    expect(stage(view, "review").status).toBe("attention");
    expect(view.review.warningCount).toBeGreaterThan(6);
  });

  it("marks shopping attention when the stored grocery list needs refresh", () => {
    const view = viewFor({
      selectedWeek: week({
        groceryList: {
          sections: [
            {
              items: [{ item: "Old item", quantity: "1" }],
              name: "Imported",
            },
          ],
        },
      }),
    });

    expect(view.shopping.hasRefreshChanges).toBe(true);
    expect(stage(view, "shop")).toMatchObject({
      actionHref: "/ingredients?weekId=week_1",
      status: "attention",
    });
  });

  it("summarizes shared shopping status counts", () => {
    const view = viewFor({
      selectedWeek: week({
        days: [
          {
            date: new Date("2026-05-04T00:00:00.000Z"),
            dinner: meal({
              ingredients: [
                { item: "Brown rice", quantity: "2 cups" },
                { item: "Chicken breast", quantity: "2 lb" },
                { item: "Olive oil", pantryItem: true, quantity: "1 bottle" },
              ],
            }),
          },
        ],
        shoppingItemStates: [
          {
            canonicalName: "brown rice",
            itemName: "Brown rice",
            quantity: "2 cups",
            status: "BOUGHT",
            updatedBy: null,
          },
        ],
      }),
    });

    expect(view.shopping).toMatchObject({
      alreadyHaveCount: 1,
      boughtCount: 1,
      neededCount: 1,
    });
    expect(stage(view, "shop").metric).toBe("1 needed");
  });

  it("does not demand closeout for future dinners", () => {
    const view = viewFor({
      selectedWeek: week(),
      today: new Date("2026-04-27T00:00:00.000Z"),
    });

    expect(view.closeout.dueCount).toBe(0);
    expect(stage(view, "closeout").status).toBe("ready");
  });

  it("flags current and past planned dinners that need closeout", () => {
    const view = viewFor({
      selectedWeek: week(),
      today: new Date("2026-05-05T00:00:00.000Z"),
    });

    expect(view.closeout.dueCount).toBe(1);
    expect(stage(view, "closeout")).toMatchObject({
      status: "attention",
    });
  });
});
