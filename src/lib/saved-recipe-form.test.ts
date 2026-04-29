import { describe, expect, it } from "vitest";

import {
  parseSavedRecipeFormData,
  tagsFromSourceRecipe,
} from "./saved-recipe-form";

function formData(values: Record<string, string | string[]>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        data.append(key, item);
      }
    } else {
      data.set(key, value);
    }
  }

  return data;
}

describe("saved recipe form parsing", () => {
  it("parses row-based ingredients, tags, source URL, and recipe metadata", () => {
    const parsed = parseSavedRecipeFormData(
      formData({
        active: "on",
        budgetFit: "on",
        costEstimateDollars: "22.50",
        cuisine: "Tex-Mex",
        diabetesFriendly: "on",
        ingredientItem: ["Ground turkey", "Brown rice", ""],
        ingredientQuantity: ["2 lb", "3 cups", ""],
        kidFriendly: "on",
        methodStepsText: "Cook turkey.\nServe bowls.",
        name: "Turkey Rice Bowls",
        noFishSafe: "on",
        prepTimeActiveMinutes: "20",
        prepTimeTotalMinutes: "40",
        servings: "7",
        sourceUrl: "https://example.com/rice-bowls",
        tagsText: "weeknight, kid favorite\nbudget",
        weeknightTimeSafe: "on",
      }),
      "user_owner",
    );

    expect(parsed).toEqual(
      expect.objectContaining({
        active: true,
        costEstimateCents: 2250,
        cuisine: "Tex-Mex",
        ingredients: [
          { item: "Ground turkey", quantity: "2 lb" },
          { item: "Brown rice", quantity: "3 cups" },
        ],
        methodSteps: ["Cook turkey.", "Serve bowls."],
        name: "Turkey Rice Bowls",
        sourceUrl: "https://example.com/rice-bowls",
        tags: ["weeknight", "kid favorite", "budget"],
        updatedByUserId: "user_owner",
      }),
    );
  });

  it("rejects recipe forms with no ingredient rows", () => {
    expect(() =>
      parseSavedRecipeFormData(
        formData({
          ingredientItem: "",
          ingredientQuantity: "",
          methodStepsText: "Cook.",
          name: "No Ingredients",
          servings: "4",
        }),
        "user_owner",
      ),
    ).toThrow("Add at least one ingredient.");
  });

  it("copies normalized tags from imported source recipes", () => {
    expect(
      tagsFromSourceRecipe({
        dinner_title: "Turkey Rice Bowls",
        tags: ["Weeknight", " kid favorite ", "Weeknight", ""],
      }),
    ).toEqual(["weeknight", "kid favorite"]);
  });
});
