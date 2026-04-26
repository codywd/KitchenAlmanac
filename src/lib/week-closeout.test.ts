import { describe, expect, it } from "vitest";

import {
  buildWeekCloseout,
  normalizeMealOutcomeStatus,
  type WeekCloseoutInput,
} from "./week-closeout";

const input: WeekCloseoutInput = {
  budgetTargetCents: 5000,
  days: [
    {
      date: "2026-05-04",
      meal: {
        actualCostCents: 2100,
        costEstimateCents: 2400,
        cuisine: "Mexican",
        feedbackReason: "Everyone asked for seconds.",
        feedbackStatus: "LIKED",
        feedbackTweaks: null,
        id: "meal_1",
        leftoverNotes: "Two lunch portions.",
        name: "Turkey Bowls",
        outcomeNotes: "Cooked as planned.",
        outcomeStatus: "COOKED",
        votes: [
          {
            comment: "Good after soccer.",
            user: {
              email: "owner@example.local",
              name: "Owner",
            },
            userId: "user_owner",
            vote: "WANT",
          },
        ],
      },
    },
    {
      date: "2026-05-05",
      meal: {
        actualCostCents: null,
        costEstimateCents: 1800,
        cuisine: "Italian",
        feedbackReason: null,
        feedbackStatus: "PLANNED",
        feedbackTweaks: null,
        id: "meal_2",
        leftoverNotes: null,
        name: "Pasta Night",
        outcomeNotes: "Schedule changed.",
        outcomeStatus: "SKIPPED",
        votes: [],
      },
    },
    {
      date: "2026-05-06",
      meal: null,
    },
  ],
  weekId: "week_1",
  weekStart: "2026-05-04",
};

describe("week closeout", () => {
  it("derives outcome counts, vote summaries, and closed-meal cost variance", () => {
    const closeout = buildWeekCloseout(input);

    expect(closeout.stats).toMatchObject({
      actualCostCents: 2100,
      closedDinners: 2,
      cookedDinners: 1,
      estimatedClosedCostCents: 2400,
      missingDinners: 1,
      plannedDinners: 2,
      skippedDinners: 1,
      unclosedDinners: 0,
    });
    expect(closeout.stats.actualCostDeltaCents).toBe(-300);
    expect(closeout.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actualCostCents: 2100,
          costDeltaCents: -300,
          date: "2026-05-04",
          mealName: "Turkey Bowls",
          needsCloseout: false,
          outcomeLabel: "Cooked",
          voteCounts: {
            NO: 0,
            OKAY: 0,
            WANT: 1,
          },
        }),
        expect.objectContaining({
          date: "2026-05-05",
          mealName: "Pasta Night",
          needsCloseout: false,
          outcomeLabel: "Skipped",
        }),
        expect.objectContaining({
          date: "2026-05-06",
          mealName: null,
          needsCloseout: false,
          outcomeLabel: "No dinner",
        }),
      ]),
    );
  });

  it("normalizes supported meal outcome statuses", () => {
    expect(normalizeMealOutcomeStatus("cooked")).toBe("COOKED");
    expect(normalizeMealOutcomeStatus("already leftovers")).toBe("LEFTOVERS");
    expect(() => normalizeMealOutcomeStatus("burned")).toThrow(
      "Unsupported meal outcome status: burned",
    );
  });
});
