import { describe, expect, it } from "vitest";

import {
  buildPlanningBriefResponse,
  parsePlanningBriefQuery,
  type PlanningBriefInput,
} from "./planning-brief";

describe("planning brief query parsing", () => {
  it("defaults to the next planning week and latest family budget", () => {
    const parsed = parsePlanningBriefQuery(new URLSearchParams(), {
      defaultBudgetTargetCents: 35000,
      now: new Date("2026-04-25T12:00:00.000Z"),
    });

    expect(parsed.weekStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(parsed.budgetTargetCents).toBe(35000);
  });

  it("accepts explicit week and budget query parameters", () => {
    const parsed = parsePlanningBriefQuery(
      new URLSearchParams({
        budgetTargetCents: "27500",
        weekStart: "2026-05-04",
      }),
      {
        defaultBudgetTargetCents: 35000,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
    );

    expect(parsed.weekStart.toISOString()).toBe("2026-05-04T00:00:00.000Z");
    expect(parsed.budgetTargetCents).toBe(27500);
  });

  it("rejects invalid week and budget values", () => {
    expect(() =>
      parsePlanningBriefQuery(new URLSearchParams({ weekStart: "2026-02-31" })),
    ).toThrow("weekStart must be a valid YYYY-MM-DD date.");
    expect(() =>
      parsePlanningBriefQuery(new URLSearchParams({ budgetTargetCents: "0" })),
    ).toThrow("budgetTargetCents must be a positive integer.");
  });
});

describe("planning brief formatting", () => {
  it("includes household context, votes, rejections, meal history, and groceries", () => {
    const input: PlanningBriefInput = {
      budgetTargetCents: 35000,
      context: {
        activeRejectedMeals: [
          {
            mealName: "Fish Tacos",
            patternToAvoid: "fish-forward dinners",
            reason: "Household allergy constraint",
            rejectedAt: "2026-04-20T00:00:00.000Z",
          },
        ],
        familyMembers: [
          { email: "owner@example.local", name: "Owner", role: "OWNER" },
          { email: "member@example.local", name: "Member", role: "MEMBER" },
        ],
        householdDocuments: [
          {
            content: "No fish. Keep weeknight active prep under 30 minutes.",
            kind: "HOUSEHOLD_PROFILE",
            title: "Household Profile",
          },
        ],
        pantryStaples: [
          {
            canonicalName: "olive oil",
            displayName: "Olive Oil",
            id: "staple_1",
          },
        ],
        savedRecipes: [
          {
            costEstimateCents: 1800,
            cuisine: "Mexican",
            flags: ["kid friendly", "budget fit"],
            id: "recipe_1",
            name: "Turkey Rice Bowls",
            prepTimeTotalMinutes: 40,
            servings: 7,
            source: "Saved from 2026-04-22; feedback liked; outcome cooked.",
          },
        ],
        recentGrocerySummaries: [
          {
            notes: "Estimated total: $312.00",
            sections: [
              {
                itemCount: 2,
                items: ["2 lb chicken", "3 bell peppers"],
                name: "Produce",
              },
            ],
            weekStart: "2026-04-20",
          },
        ],
        recentIngredientSignals: [
          {
            displayTotal: "5 cup",
            mealNames: ["Turkey Bowls", "Quesadillas"],
            name: "brown rice",
            pantryItem: false,
          },
        ],
        recentMeals: [
          {
            actualCostCents: 2100,
            costEstimateCents: 1800,
            cuisine: "Mexican",
            date: "2026-04-22",
            feedbackReason: "Everyone ate it",
            feedbackStatus: "LIKED",
            feedbackTweaks: null,
            flags: ["kid friendly", "budget fit"],
            leftoverNotes: "Two lunch portions.",
            name: "Turkey Bowls",
            outcomeNotes: "Cooked as planned.",
            outcomeStatus: "COOKED",
            weekStart: "2026-04-20",
          },
        ],
        recentVotes: [
          {
            comment: "More rice bowls please",
            mealDate: "2026-04-22",
            mealName: "Turkey Bowls",
            updatedAt: "2026-04-23T00:00:00.000Z",
            vote: "WANT",
            voterEmail: "member@example.local",
            voterName: "Member",
            weekStart: "2026-04-20",
          },
        ],
      },
      family: {
        id: "family_1",
        name: "Test Family",
      },
      generatedAt: "2026-04-25T12:00:00.000Z",
      weekStart: new Date("2026-04-27T00:00:00.000Z"),
    };

    const response = buildPlanningBriefResponse(input);

    expect(response.weekStart).toBe("2026-04-27");
    expect(response.weekEnd).toBe("2026-05-03");
    expect(response.context.recentVotes).toHaveLength(1);
    expect(response.briefMarkdown).toContain("# Meal Planning Brief");
    expect(response.briefMarkdown).toContain("Target week: 2026-04-27 through 2026-05-03");
    expect(response.briefMarkdown).toContain("Budget target: $350");
    expect(response.briefMarkdown).toContain("No fish. Keep weeknight active prep under 30 minutes.");
    expect(response.briefMarkdown).toContain("Fish Tacos: Household allergy constraint.");
    expect(response.briefMarkdown).toContain("Member voted Want - \"More rice bowls please\".");
    expect(response.briefMarkdown).toContain("Olive Oil (olive oil)");
    expect(response.briefMarkdown).toContain(
      "Turkey Rice Bowls (Mexican): serves 7; total time 40 min; cost $18; flags: kid friendly, budget fit; Saved from 2026-04-22; feedback liked; outcome cooked.",
    );
    expect(response.briefMarkdown).toContain("Turkey Bowls (Mexican); cost $18");
    expect(response.briefMarkdown).toContain(
      "outcome cooked; actual $21; outcome notes: Cooked as planned.; leftovers: Two lunch portions.",
    );
    expect(response.briefMarkdown).toContain("Week 2026-04-20 (Estimated total: $312.00): Produce 2 items");
    expect(response.briefMarkdown).toContain("brown rice: 5 cup; used by Turkey Bowls, Quesadillas.");
    expect(response.briefMarkdown).toContain("POST /api/import/meal-plan");
  });
});
