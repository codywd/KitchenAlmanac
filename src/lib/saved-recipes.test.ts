import { describe, expect, it } from "vitest";

import {
  buildSavedRecipeDataFromMeal,
  savedRecipeToMealCreateData,
  savedRecipesForPlannerContext,
} from "./saved-recipes";

const meal = {
  actualCostCents: 2100,
  batchPrepNote: "Prep rice ahead.",
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
  diabetesFriendly: true,
  feedbackReason: "Everyone ate it.",
  feedbackStatus: "LIKED",
  feedbackTweaks: "Use less rice.",
  heartHealthy: true,
  id: "meal_1",
  ingredients: [
    { item: "ground turkey", quantity: "2 lb" },
    { item: "brown rice", pantryItem: true, quantity: "3 cup" },
  ],
  kidAdaptations: "Serve toppings separately.",
  kidFriendly: true,
  methodSteps: ["Cook rice.", "Brown turkey."],
  name: "Turkey Rice Bowls",
  noFishSafe: true,
  outcomeStatus: "COOKED",
  prepTimeActiveMinutes: 20,
  prepTimeTotalMinutes: 40,
  servings: 7,
  sourceRecipe: { dinner_title: "Turkey Rice Bowls" },
  validationNotes: "Good weeknight fit.",
  weeknightTimeSafe: true,
};

describe("saved recipe helpers", () => {
  it("copies a meal into family-scoped saved recipe data with source metadata", () => {
    const data = buildSavedRecipeDataFromMeal({
      familyId: "family_1",
      meal,
      userId: "user_owner",
    });

    expect(data).toEqual(
      expect.objectContaining({
        active: true,
        actualCostCents: 2100,
        createdByUserId: "user_owner",
        familyId: "family_1",
        feedbackReason: "Everyone ate it.",
        feedbackStatus: "LIKED",
        name: "Turkey Rice Bowls",
        sourceMealDate: new Date("2026-05-05T00:00:00.000Z"),
        sourceMealId: "meal_1",
        sourceWeekId: "week_1",
        sourceWeekStart: new Date("2026-05-04T00:00:00.000Z"),
        updatedByUserId: "user_owner",
      }),
    );
    expect(data.ingredients).toEqual(meal.ingredients);
    expect(data.methodSteps).toEqual(["Cook rice.", "Brown turkey."]);
  });

  it("converts a saved recipe into fresh planned meal create data", () => {
    const mealData = savedRecipeToMealCreateData({
      ...buildSavedRecipeDataFromMeal({
        familyId: "family_1",
        meal,
        userId: "user_owner",
      }),
      archivedAt: null,
      archivedByUserId: null,
      createdAt: new Date("2026-05-06T00:00:00.000Z"),
      id: "recipe_1",
      updatedAt: new Date("2026-05-06T00:00:00.000Z"),
    });

    expect(mealData).toEqual(
      expect.objectContaining({
        actualCostCents: null,
        closedOutAt: null,
        feedbackReason: null,
        feedbackStatus: "PLANNED",
        name: "Turkey Rice Bowls",
        outcomeStatus: "PLANNED",
      }),
    );
    expect(mealData.sourceRecipe).toEqual({
      dinner_title: "Turkey Rice Bowls",
      savedRecipeId: "recipe_1",
      savedRecipeName: "Turkey Rice Bowls",
    });
  });

  it("formats only active saved recipes for planner context", () => {
    const summaries = savedRecipesForPlannerContext([
      {
        ...buildSavedRecipeDataFromMeal({
          familyId: "family_1",
          meal,
          userId: "user_owner",
        }),
        active: true,
        archivedAt: null,
        archivedByUserId: null,
        createdAt: new Date("2026-05-06T00:00:00.000Z"),
        id: "recipe_1",
        updatedAt: new Date("2026-05-06T00:00:00.000Z"),
      },
      {
        ...buildSavedRecipeDataFromMeal({
          familyId: "family_1",
          meal: { ...meal, id: "meal_2", name: "Archived Bowls" },
          userId: "user_owner",
        }),
        active: false,
        archivedAt: new Date("2026-05-07T00:00:00.000Z"),
        archivedByUserId: "user_owner",
        createdAt: new Date("2026-05-06T00:00:00.000Z"),
        id: "recipe_2",
        updatedAt: new Date("2026-05-07T00:00:00.000Z"),
      },
    ]);

    expect(summaries).toEqual([
      expect.objectContaining({
        costEstimateCents: 1800,
        flags: expect.arrayContaining(["kid friendly", "budget fit"]),
        id: "recipe_1",
        name: "Turkey Rice Bowls",
        source: "Saved from 2026-05-05; feedback liked; outcome cooked.",
      }),
    ]);
  });
});
