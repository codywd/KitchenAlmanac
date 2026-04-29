import { describe, expect, it } from "vitest";

import { buildMealAnalytics } from "./meal-analytics";

describe("meal analytics", () => {
  it("summarizes weekly cost, outcome, flag, and nutrition trends", () => {
    const analytics = buildMealAnalytics({
      weeks: [
        {
          budgetTargetCents: 6000,
          days: [
            {
              date: new Date("2026-05-04T00:00:00.000Z"),
              dinner: {
                actualCostCents: 2100,
                budgetFit: true,
                costEstimateCents: 1800,
                diabetesFriendly: true,
                heartHealthy: true,
                id: "meal_1",
                kidFriendly: true,
                name: "Turkey Rice Bowls",
                noFishSafe: true,
                outcomeStatus: "COOKED",
                sourceRecipe: {
                  nutrition_estimate_per_serving: {
                    calories: 520,
                    protein_g: 35,
                    sodium_mg: 700,
                  },
                },
                weeknightTimeSafe: true,
              },
            },
            {
              date: new Date("2026-05-05T00:00:00.000Z"),
              dinner: {
                actualCostCents: null,
                budgetFit: false,
                costEstimateCents: 2400,
                diabetesFriendly: false,
                heartHealthy: false,
                id: "meal_2",
                kidFriendly: false,
                name: "Pizza",
                noFishSafe: true,
                outcomeStatus: "SKIPPED",
                sourceRecipe: null,
                weeknightTimeSafe: true,
              },
            },
          ],
          id: "week_1",
          title: "May 4",
          weekStart: new Date("2026-05-04T00:00:00.000Z"),
        },
      ],
    });

    expect(analytics.weeklyCosts).toEqual([
      expect.objectContaining({
        actualCostCents: 2100,
        budgetTargetCents: 6000,
        costDeltaCents: 300,
        estimatedCostCents: 4200,
        weekStart: "2026-05-04",
      }),
    ]);
    expect(analytics.outcomeMix).toEqual(
      expect.arrayContaining([
        { count: 1, status: "COOKED" },
        { count: 1, status: "SKIPPED" },
      ]),
    );
    expect(analytics.healthFlagCoverage[0]).toEqual(
      expect.objectContaining({
        diabetesFriendly: 1,
        heartHealthy: 1,
        plannedDinners: 2,
      }),
    );
    expect(analytics.nutritionAverages).toEqual([
      { key: "calories", label: "Calories", sampleCount: 1, value: 520 },
      { key: "protein_g", label: "Protein", sampleCount: 1, value: 35 },
      { key: "sodium_mg", label: "Sodium", sampleCount: 1, value: 700 },
    ]);
    expect(analytics.biggestEstimateMisses[0]).toEqual(
      expect.objectContaining({
        costDeltaCents: 300,
        mealName: "Turkey Rice Bowls",
      }),
    );
  });

  it("keeps empty history renderable", () => {
    const analytics = buildMealAnalytics({ weeks: [] });

    expect(analytics.weeklyCosts).toEqual([]);
    expect(analytics.outcomeMix).toEqual([]);
    expect(analytics.nutritionAverages).toEqual([]);
    expect(analytics.summary.plannedDinners).toBe(0);
  });
});
