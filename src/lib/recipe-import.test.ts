import { describe, expect, it } from "vitest";

import {
  normalizeImportedMealPlan,
  normalizeImportedRecipe,
  normalizeImportedSavedRecipe,
} from "./recipe-import";

const samplePlan = {
  schema_version: "1.0",
  input_summary: {
    assumptions: ["Brown rice is purchased once and used across multiple meals."],
    budget_target_usd: 200,
    constraints: ["No fish or shellfish", "Mild, family-friendly meals"],
    family_size: 5,
  },
  recipes: [
    {
      day: "Monday",
      dinner_title: "Veggie Quesadilla Night with Black Beans",
      estimated_cost_usd: 21.25,
      health_adjustment: {
        changes: ["Use whole wheat tortillas."],
        for_person: "Cody",
        plate_build: "Serve extra beans and vegetables.",
        why_it_helps: ["Beans and vegetables add fiber."],
      },
      ingredients: [
        {
          amount: 10,
          name: "whole wheat tortillas, 8-inch",
          optional: false,
          pantry_item: false,
          preparation: "use 1 to 2 per person",
          substitutes: ["corn tortillas"],
          unit: "tortillas",
        },
      ],
      instructions: [
        {
          step: 2,
          text: "Cook until golden.",
          time_minutes: 12,
        },
        {
          step: 1,
          text: "Fill tortillas.",
          time_minutes: 5,
        },
      ],
      kid_friendly_variation: {
        notes: ["Offer dips separately."],
        serve_components_separately: true,
        strategy: "Let kids choose their fillings.",
      },
      leftovers: {
        expected: true,
        reuse_ideas: ["Use for lunch wraps."],
        storage: "Refrigerate up to 4 days.",
      },
      nutrition_estimate_per_serving: {
        fiber_g: 14,
        sodium_mg: 780,
      },
      servings: 5,
      tags: ["meatless", "kid-friendly", "budget-friendly"],
      time: {
        prep_minutes: 15,
        total_minutes: 35,
      },
      why_this_works: "Black beans make the meal filling.",
    },
  ],
  shopping_list: {
    grains_bread: [
      {
        estimated_cost_usd: 7,
        item: "whole wheat tortillas, 8-inch",
        pantry_item: false,
        total_amount: 20,
        unit: "tortillas",
        used_in_recipes: ["Veggie Quesadilla Night with Black Beans"],
      },
    ],
    other: [],
  },
  weekly_overview: {
    budget_status: "within_target",
    coordination_strategy: ["Reuse rice."],
    estimated_total_grocery_cost_usd: 164.75,
    leftover_plan: ["Use leftovers for lunches."],
    prep_ahead: [
      {
        instructions: "Cook 4 cups dry brown rice.",
        item: "Cook brown rice",
        minutes: 45,
        when: "Monday",
      },
    ],
    theme: "Flexible family dinners.",
  },
};

describe("recipe import normalization", () => {
  it("normalizes one structured recipe into saved recipe create data", () => {
    const normalized = normalizeImportedSavedRecipe({
      recipe: {
        cuisine: "Tex-Mex",
        dinner_title: "Chicken Taco Rice Skillet",
        estimated_cost_usd: 18.75,
        health_adjustment: {
          plate_build: "Serve with extra peppers and beans.",
          why_it_helps: ["Adds fiber."],
        },
        ingredients: [
          {
            amount: 1.5,
            name: "boneless chicken thighs",
            pantry_item: false,
            preparation: "bite-size pieces",
            unit: "lb",
          },
        ],
        instructions: [
          { step: 2, text: "Simmer with rice until tender." },
          { step: 1, text: "Brown the chicken." },
        ],
        kid_friendly_variation: {
          notes: ["Keep toppings separate."],
          strategy: "Serve as a build-your-own bowl.",
        },
        leftovers: {
          reuse_ideas: ["Roll into burritos."],
          storage: "Refrigerate up to 4 days.",
        },
        servings: 6,
        source_url: "https://example.com/chicken-taco-rice",
        tags: ["Weeknight", "Kid Friendly", "weeknight"],
        time: {
          prep_minutes: 15,
          total_minutes: 40,
        },
        why_this_works: "One-pan dinner with familiar flavors.",
      },
    });

    expect(normalized).toMatchObject({
      active: true,
      costEstimateCents: 1875,
      cuisine: "Tex-Mex",
      ingredients: [
        {
          item: "boneless chicken thighs",
          pantryItem: false,
          preparation: "bite-size pieces",
          quantity: "1.5 lb",
        },
      ],
      methodSteps: ["Brown the chicken.", "Simmer with rice until tender."],
      name: "Chicken Taco Rice Skillet",
      prepTimeActiveMinutes: 15,
      prepTimeTotalMinutes: 40,
      servings: 6,
      sourceUrl: "https://example.com/chicken-taco-rice",
      tags: ["weeknight", "kid friendly"],
      validation: {
        diabetesFriendly: true,
        heartHealthy: true,
        kidFriendly: true,
        noFishSafe: true,
        weeknightTimeSafe: true,
      },
    });
    expect(normalized.sourceRecipe).toMatchObject({
      dinner_title: "Chicken Taco Rice Skillet",
      source_url: "https://example.com/chicken-taco-rice",
    });
    expect(normalized.validation.validationNotes).toContain(
      "One-pan dinner with familiar flavors.",
    );
  });

  it("rejects a single recipe import without ingredients", () => {
    expect(() =>
      normalizeImportedSavedRecipe({
        recipe: {
          dinner_title: "Sauce Night",
          ingredients: [],
        },
      }),
    ).toThrow("Add at least one ingredient.");
  });

  it("normalizes a single outside-LLM recipe for a forced swap date", () => {
    const normalized = normalizeImportedRecipe({
      budgetTargetUsd: 25,
      constraints: ["No fish"],
      date: new Date("2026-05-06T00:00:00.000Z"),
      familySize: 6,
      recipe: {
        day: "Sunday",
        dinner_title: "Lemon Chicken Rice Bowls",
        estimated_cost_usd: 24.5,
        health_adjustment: {
          changes: ["Use brown rice and extra vegetables."],
          plate_build: "Half vegetables, quarter chicken, quarter rice.",
          why_it_helps: ["Keeps the plate balanced."],
        },
        ingredients: [
          {
            amount: 2,
            name: "boneless skinless chicken breasts",
            pantry_item: false,
            preparation: "sliced",
            unit: "lb",
          },
        ],
        instructions: [
          { step: 2, text: "Simmer with lemon sauce." },
          { step: 1, text: "Brown the chicken." },
        ],
        kid_friendly_variation: {
          notes: ["Keep sauce on the side."],
          strategy: "Serve bowls deconstructed.",
        },
        leftovers: {
          reuse_ideas: ["Pack leftovers for lunch."],
          storage: "Refrigerate up to 3 days.",
        },
        tags: ["kid-friendly"],
        time: {
          prep_minutes: 20,
          total_minutes: 40,
        },
      },
      withinBudget: false,
    });

    expect(normalized.date).toEqual(new Date("2026-05-06T00:00:00.000Z"));
    expect(normalized.meal).toMatchObject({
      budgetFit: true,
      costEstimateCents: 2450,
      diabetesFriendly: true,
      heartHealthy: true,
      ingredients: [
        {
          item: "boneless skinless chicken breasts",
          pantryItem: false,
          preparation: "sliced",
          quantity: "2 lb",
        },
      ],
      kidFriendly: true,
      methodSteps: ["Brown the chicken.", "Simmer with lemon sauce."],
      name: "Lemon Chicken Rice Bowls",
      noFishSafe: true,
      prepTimeActiveMinutes: 20,
      prepTimeTotalMinutes: 40,
      servings: 6,
      weeknightTimeSafe: true,
    });
    expect(normalized.meal.sourceRecipe).toMatchObject({
      day: "Sunday",
      dinner_title: "Lemon Chicken Rice Bowls",
    });
  });

  it("maps the external weekly recipe schema into app week, meal, and grocery data", () => {
    const normalized = normalizeImportedMealPlan({
      plan: samplePlan,
      weekStart: new Date("2026-04-27T00:00:00.000Z"),
    });

    expect(normalized.week.title).toBe("Flexible family dinners.");
    expect(normalized.week.budgetTargetCents).toBe(20000);
    expect(normalized.week.notes).toContain("Prep ahead");
    expect(normalized.week.sourceImport).toMatchObject({
      schema_version: "1.0",
      importedRecipeCount: 1,
    });

    expect(normalized.groceryList?.sections).toEqual([
      {
        items: [
          {
            estimatedCostUsd: 7,
            item: "whole wheat tortillas, 8-inch",
            pantryItem: false,
            quantity: "20 tortillas",
            usedInRecipes: ["Veggie Quesadilla Night with Black Beans"],
          },
        ],
        name: "Grains bread",
      },
    ]);

    expect(normalized.meals).toHaveLength(1);
    expect(normalized.meals[0]).toMatchObject({
      date: new Date("2026-04-27T00:00:00.000Z"),
      meal: {
        budgetFit: true,
        costEstimateCents: 2125,
        diabetesFriendly: true,
        heartHealthy: true,
        ingredients: [
          {
            item: "whole wheat tortillas, 8-inch",
            optional: false,
            pantryItem: false,
            preparation: "use 1 to 2 per person",
            quantity: "10 tortillas",
            substitutes: ["corn tortillas"],
          },
        ],
        kidFriendly: true,
        methodSteps: ["Fill tortillas.", "Cook until golden."],
        name: "Veggie Quesadilla Night with Black Beans",
        noFishSafe: true,
        prepTimeActiveMinutes: 15,
        prepTimeTotalMinutes: 35,
        servings: 5,
        weeknightTimeSafe: true,
      },
    });
    expect(normalized.meals[0].meal.sourceRecipe).toMatchObject({
      day: "Monday",
      dinner_title: "Veggie Quesadilla Night with Black Beans",
    });
  });
});
