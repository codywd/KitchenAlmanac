import { describe, expect, it } from "vitest";

import { buildMealMemoryDashboard, type MealMemoryInput } from "./meal-memory";

const input: MealMemoryInput = {
  meals: [
    {
      actualCostCents: 1900,
      costEstimateCents: 1800,
      cuisine: "Mexican",
      date: "2026-04-20",
      feedbackReason: "Everyone cleaned plates.",
      feedbackStatus: "LIKED",
      feedbackTweaks: null,
      id: "meal_taco_bowls",
      leftoverNotes: "Packed two lunches.",
      name: "Turkey Taco Bowls",
      outcomeNotes: "Cooked as planned.",
      outcomeStatus: "COOKED",
      votes: [
        {
          comment: "Bring this back soon.",
          user: {
            email: "owner@example.local",
            name: "Owner",
          },
          userId: "user_owner",
          vote: "WANT",
        },
        {
          comment: "Good for the kids.",
          user: {
            email: "member@example.local",
            name: "Member",
          },
          userId: "user_member",
          vote: "WANT",
        },
      ],
      weekId: "week_1",
    },
    {
      actualCostCents: null,
      costEstimateCents: 2200,
      cuisine: "Italian",
      date: "2026-04-21",
      feedbackReason: "Too heavy.",
      feedbackStatus: "REJECTED",
      feedbackTweaks: null,
      id: "meal_cream_pasta",
      leftoverNotes: null,
      name: "Heavy Cream Pasta",
      outcomeNotes: "Skipped after the first few bites.",
      outcomeStatus: "SKIPPED",
      votes: [
        {
          comment: "Too rich for weeknights.",
          user: {
            email: "owner@example.local",
            name: "Owner",
          },
          userId: "user_owner",
          vote: "NO",
        },
      ],
      weekId: "week_1",
    },
    {
      actualCostCents: 2100,
      costEstimateCents: 2100,
      cuisine: "Mediterranean",
      date: "2026-04-22",
      feedbackReason: "Needs more seasoning.",
      feedbackStatus: "WORKED_WITH_TWEAKS",
      feedbackTweaks: "Add more spice at the table.",
      id: "meal_chicken_pitas",
      leftoverNotes: "Enough chicken for salads.",
      name: "Chicken Pita Plates",
      outcomeNotes: "Worked with extra sauce.",
      outcomeStatus: "LEFTOVERS",
      votes: [
        {
          comment: "Okay if there is more sauce.",
          user: {
            email: "member@example.local",
            name: "Member",
          },
          userId: "user_member",
          vote: "OKAY",
        },
      ],
      weekId: "week_1",
    },
  ],
  rejectedMeals: [
    {
      active: true,
      mealName: "Fish Tacos",
      patternToAvoid: "fish-forward dinners",
      reason: "Allyson does not eat fish.",
      rejectedAt: "2026-04-23",
    },
  ],
};

describe("meal memory dashboard", () => {
  it("summarizes family votes, repeat candidates, avoid signals, and comment themes", () => {
    const dashboard = buildMealMemoryDashboard(input);

    expect(dashboard.stats).toEqual({
      activeRejectedPatterns: 1,
      actualCostCents: 4000,
      cookedDinners: 1,
      leftoverDinners: 1,
      likedMeals: 1,
      mealsReviewed: 3,
      noVotes: 1,
      replacedDinners: 0,
      skippedDinners: 1,
      totalVotes: 4,
      unclosedDinners: 0,
      wantVotes: 2,
    });

    expect(dashboard.topWantedMeals[0]).toMatchObject({
      lastServedDate: "2026-04-20",
      mealName: "Turkey Taco Bowls",
      noVotes: 0,
      wantVotes: 2,
    });
    expect(dashboard.repeatCandidates[0]).toMatchObject({
      mealId: "meal_taco_bowls",
      mealName: "Turkey Taco Bowls",
      reason: "Liked meal with 2 Want votes.",
      score: 5,
    });
    expect(dashboard.avoidSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mealName: "Heavy Cream Pasta",
          reason: "Rejected meal feedback: Too heavy.",
          source: "feedback",
        }),
        expect.objectContaining({
          mealName: "Heavy Cream Pasta",
          reason: "1 family member voted No.",
          source: "vote",
        }),
        expect.objectContaining({
          mealName: "Fish Tacos",
          reason: "Allyson does not eat fish.",
          source: "rejected-pattern",
        }),
      ]),
    );
    expect(dashboard.memberPatterns).toEqual([
      {
        comments: 2,
        label: "Member",
        no: 0,
        okay: 1,
        total: 2,
        want: 1,
      },
      {
        comments: 2,
        label: "Owner",
        no: 1,
        okay: 0,
        total: 2,
        want: 1,
      },
    ]);
    expect(dashboard.commentThemes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commentCount: 2,
          theme: "Repeat",
        }),
        expect.objectContaining({
          commentCount: 1,
          theme: "Kid Fit",
        }),
      ]),
    );
  });

  it("keeps empty dashboards renderable", () => {
    const dashboard = buildMealMemoryDashboard({
      meals: [],
      rejectedMeals: [],
    });

    expect(dashboard.stats.mealsReviewed).toBe(0);
    expect(dashboard.stats.actualCostCents).toBeNull();
    expect(dashboard.topWantedMeals).toEqual([]);
    expect(dashboard.repeatCandidates).toEqual([]);
    expect(dashboard.avoidSignals).toEqual([]);
    expect(dashboard.memberPatterns).toEqual([]);
    expect(dashboard.commentThemes).toEqual([]);
  });
});
