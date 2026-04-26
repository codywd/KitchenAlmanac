import { describe, expect, it } from "vitest";

import { buildWeekReview, type WeekReviewInput } from "./week-review";

const input: WeekReviewInput = {
  activeRejectedMeals: [
    {
      mealName: "Fish Tacos",
      patternToAvoid: "fish tacos",
      reason: "Household does not want fish dinners.",
    },
  ],
  budgetTargetCents: 3000,
  days: [
    {
      date: "2026-05-04",
      meal: {
        budgetFit: true,
        costEstimateCents: 2200,
        cuisine: "Mexican",
        diabetesFriendly: true,
        heartHealthy: true,
        id: "meal_turkey",
        kidFriendly: true,
        name: "Turkey Bowls",
        noFishSafe: true,
        searchText: "turkey bowls brown rice",
        servings: 6,
        votes: [
          {
            comment: "Bring this back.",
            user: {
              email: "owner@example.local",
              name: "Owner",
            },
            userId: "user_owner",
            vote: "WANT",
          },
        ],
        weeknightTimeSafe: true,
      },
    },
    {
      date: "2026-05-05",
      meal: {
        budgetFit: false,
        costEstimateCents: 1800,
        cuisine: "Seafood",
        diabetesFriendly: false,
        heartHealthy: false,
        id: "meal_fish",
        kidFriendly: false,
        name: "Fish Tacos",
        noFishSafe: false,
        searchText: "fish tacos tilapia cabbage",
        servings: 6,
        votes: [
          {
            comment: "Please not fish.",
            user: {
              email: "member@example.local",
              name: "Member",
            },
            userId: "user_member",
            vote: "NO",
          },
        ],
        weeknightTimeSafe: false,
      },
    },
    {
      date: "2026-05-06",
      meal: null,
    },
  ],
  ingredients: [
    {
      canonicalName: "brown rice",
      days: [
        {
          date: new Date("2026-05-04T00:00:00.000Z"),
          displayQuantity: "2 cups",
          mealName: "Turkey Bowls",
        },
      ],
      displayTotal: "2 cups",
      pantryItem: true,
    },
    {
      canonicalName: "tilapia",
      days: [
        {
          date: new Date("2026-05-05T00:00:00.000Z"),
          displayQuantity: "2 lb",
          mealName: "Fish Tacos",
        },
      ],
      displayTotal: "2 lb",
      pantryItem: false,
    },
  ],
  recentMeals: [
    {
      date: "2026-04-20",
      feedbackStatus: "LIKED",
      name: "Turkey Bowls",
    },
  ],
  weekId: "week_1",
  weekStart: "2026-05-04",
};

describe("week review", () => {
  it("derives review issues, vote signals, ingredient uses, and budget summary", () => {
    const review = buildWeekReview(input);

    expect(review.stats).toMatchObject({
      plannedDinners: 2,
      totalCostEstimateCents: 4000,
      totalInfo: 1,
      totalWarnings: 6,
    });
    expect(review.weekIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Over Budget Target",
        }),
      ]),
    );
    expect(review.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-05-04",
          ingredientUses: [
            expect.objectContaining({
              canonicalName: "brown rice",
            }),
          ],
          issues: expect.arrayContaining([
            expect.objectContaining({
              title: "Recent Repeat",
            }),
            expect.objectContaining({
              title: "Family Want Vote",
            }),
          ]),
          mealName: "Turkey Bowls",
          voteCounts: {
            NO: 0,
            OKAY: 0,
            WANT: 1,
          },
        }),
        expect.objectContaining({
          date: "2026-05-05",
          issues: expect.arrayContaining([
            expect.objectContaining({
              title: "Active Rejection Match",
            }),
            expect.objectContaining({
              title: "Family No Vote",
            }),
            expect.objectContaining({
              title: "Missing Planning Flags",
            }),
          ]),
          mealName: "Fish Tacos",
        }),
        expect.objectContaining({
          date: "2026-05-06",
          issues: [
            expect.objectContaining({
              title: "Missing Dinner",
            }),
          ],
          mealName: null,
        }),
      ]),
    );
  });
});
