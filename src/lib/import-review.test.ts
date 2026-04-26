import { describe, expect, it } from "vitest";

import {
  buildImportReview,
  toImportReviewContext,
  type ImportReviewContext,
} from "./import-review";

function recipe(day: string, title: string, overrides = {}) {
  return {
    day,
    dinner_title: title,
    estimated_cost_usd: 18,
    health_adjustment: {
      changes: ["Use lean protein and extra vegetables."],
      for_person: "Cody",
      plate_build: "Half vegetables, quarter protein, quarter whole grain.",
      why_it_helps: ["Balances fiber and protein."],
    },
    ingredients: [
      {
        amount: 2,
        name: "brown rice",
        pantry_item: true,
        unit: "cups",
      },
    ],
    instructions: [{ step: 1, text: "Cook dinner." }],
    kid_friendly_variation: {
      strategy: "Serve components separately.",
    },
    tags: ["kid-friendly", "budget-friendly"],
    time: {
      prep_minutes: 20,
      total_minutes: 35,
    },
    ...overrides,
  };
}

const sevenDayPlan = {
  input_summary: {
    budget_target_usd: 350,
    constraints: ["No fish"],
    family_size: 7,
  },
  recipes: [
    recipe("Monday", "Turkey Bowls"),
    recipe("Tuesday", "Fish Tacos", {
      health_adjustment: undefined,
      kid_friendly_variation: undefined,
      tags: [],
      time: { prep_minutes: 50, total_minutes: 55 },
    }),
    recipe("Wednesday", "Chicken Fajitas"),
    recipe("Thursday", "Lentil Soup"),
    recipe("Friday", "Pasta Night"),
    recipe("Saturday", "Sheet Pan Chicken"),
    recipe("Sunday", "Bean Chili"),
  ],
  schema_version: "1.0",
  shopping_list: {
    pantry: [
      {
        item: "brown rice",
        pantry_item: true,
        total_amount: 4,
        unit: "cups",
      },
    ],
    produce: [
      {
        item: "bell peppers",
        total_amount: 6,
        unit: "each",
      },
    ],
  },
  weekly_overview: {
    estimated_total_grocery_cost_usd: 375,
    theme: "Busy family week",
  },
};

const context: ImportReviewContext = {
  activeRejectedMeals: [
    {
      mealName: "Fish Tacos",
      patternToAvoid: "fish tacos",
      reason: "Household does not want fish dinners.",
    },
  ],
  budgetTargetCents: 35000,
  recentMeals: [
    {
      date: "2026-04-22",
      feedbackStatus: "LIKED",
      name: "Turkey Bowls",
    },
  ],
  recentVotes: [
    {
      comment: "Please not again",
      mealName: "Lentil Soup",
      vote: "NO",
      voterEmail: "member@example.local",
      voterName: "Member",
    },
    {
      comment: "Great for weeknights",
      mealName: "Chicken Fajitas",
      vote: "WANT",
      voterEmail: "owner@example.local",
      voterName: "Owner",
    },
  ],
};

describe("import review", () => {
  it("maps planner context into the smaller import-review context", () => {
    expect(
      toImportReviewContext({
        budgetTargetCents: 35000,
        planningContext: {
          activeRejectedMeals: context.activeRejectedMeals,
          recentMeals: context.recentMeals,
          recentVotes: context.recentVotes,
        },
      }),
    ).toEqual(context);
  });

  it("builds a seven-day preview with budget, grocery, history, rejection, and vote warnings", () => {
    const review = buildImportReview({
      context,
      plan: sevenDayPlan,
      weekStart: new Date("2026-05-04T00:00:00.000Z"),
    });

    expect(review.canImport).toBe(true);
    expect(review.weekStart).toBe("2026-05-04");
    expect(review.weekEnd).toBe("2026-05-10");
    expect(review.title).toBe("Busy family week");
    expect(review.dayPreviews).toHaveLength(7);
    expect(review.grocerySummary).toMatchObject({
      itemCount: 2,
      sectionCount: 2,
    });

    expect(review.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          title: "Over Budget Target",
        }),
        expect.objectContaining({
          mealName: "Fish Tacos",
          severity: "warning",
          title: "Active Rejection Match",
        }),
        expect.objectContaining({
          mealName: "Turkey Bowls",
          severity: "warning",
          title: "Recent Repeat",
        }),
        expect.objectContaining({
          mealName: "Lentil Soup",
          severity: "warning",
          title: "Recent No Vote",
        }),
        expect.objectContaining({
          mealName: "Chicken Fajitas",
          severity: "info",
          title: "Recent Want Vote",
        }),
        expect.objectContaining({
          mealName: "Fish Tacos",
          severity: "warning",
          title: "Missing Planning Flags",
        }),
      ]),
    );
  });

  it("blocks duplicate or out-of-week recipe dates before import", () => {
    const review = buildImportReview({
      context: {
        activeRejectedMeals: [],
        budgetTargetCents: null,
        recentMeals: [],
        recentVotes: [],
      },
      plan: {
        ...sevenDayPlan,
        recipes: [
          recipe("Monday", "First Monday"),
          recipe("Monday", "Second Monday"),
          recipe("Tuesday", "Tuesday Dinner"),
          recipe("Wednesday", "Wednesday Dinner"),
          recipe("Thursday", "Thursday Dinner"),
          recipe("Friday", "Friday Dinner"),
          recipe("Saturday", "Saturday Dinner"),
          recipe("Sunday", "Sunday Dinner"),
          recipe("", "Extra Dinner"),
        ],
      },
      weekStart: new Date("2026-05-04T00:00:00.000Z"),
    });

    expect(review.canImport).toBe(false);
    expect(review.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Duplicate Dinner Date",
        }),
        expect.objectContaining({
          title: "Dinner Outside Target Week",
        }),
      ]),
    );
  });
});
