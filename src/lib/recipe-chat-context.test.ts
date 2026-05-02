import { describe, expect, it } from "vitest";

import { buildRecipeChatSystemPrompt } from "./recipe-chat-context";

describe("recipe chat context", () => {
  it("includes recipe and household context without email addresses", () => {
    const prompt = buildRecipeChatSystemPrompt({
      household: {
        activeRejectedMeals: [
          {
            mealName: "Fish Tacos",
            patternToAvoid: "fish",
            reason: "No fish in the house.",
            rejectedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        householdDocuments: [
          {
            content: "Prefer lower sodium dinners.",
            kind: "MEDICAL_GUIDELINES",
            title: "Medical Guidelines",
          },
        ],
        pantryStaples: [
          {
            canonicalName: "brown rice",
            displayName: "Brown rice",
            id: "staple_1",
          },
        ],
        recentMeals: [
          {
            actualCostCents: null,
            costEstimateCents: 2400,
            cuisine: "Tex-Mex",
            date: "2026-04-28",
            feedbackReason: "Worked well.",
            feedbackStatus: "LIKED",
            feedbackTweaks: null,
            flags: ["kid friendly"],
            leftoverNotes: null,
            name: "Chicken Fajitas",
            outcomeNotes: null,
            outcomeStatus: "COOKED",
            weekStart: "2026-04-27",
          },
        ],
        recentVotes: [
          {
            comment: "More toppings next time.",
            mealDate: "2026-04-28",
            mealName: "Chicken Fajitas",
            updatedAt: "2026-04-28T00:00:00.000Z",
            vote: "WANT",
            voterEmail: "kid@example.local",
            voterName: "Kid",
            weekStart: "2026-04-27",
          },
        ],
        savedRecipes: [],
      },
      recipe: {
        costLabel: "$24",
        dateLabel: "Tuesday, Apr 28",
        equipment: ["sheet pan"],
        health: {
          changes: ["Use less salt."],
          whyItHelps: [],
        },
        ingredients: [
          {
            id: "chicken",
            name: "Chicken",
            pantryItem: false,
            quantity: "2 lb",
            substitutes: ["tofu"],
          },
        ],
        kid: {
          notes: ["Keep sauce separate."],
        },
        leftovers: {
          reuseIdeas: ["Rice bowls"],
        },
        nutrition: [{ key: "sodium_mg", label: "Sodium", value: "720 mg" }],
        servingNotes: ["Warm tortillas."],
        servings: 6,
        steps: [
          {
            id: "cook",
            number: 1,
            text: "Roast until done.",
          },
        ],
        title: "Chicken Fajitas",
        validationFlags: [{ active: true, label: "Kid-adapted" }],
        whyThisWorks: "Fast sheet pan dinner.",
      },
    });

    expect(prompt).toContain("Chicken Fajitas");
    expect(prompt).toContain("Prefer lower sodium dinners.");
    expect(prompt).toContain("No fish in the house.");
    expect(prompt).toContain("More toppings next time.");
    expect(prompt).not.toContain("kid@example.local");
  });
});
