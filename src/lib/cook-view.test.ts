import { describe, expect, it } from "vitest";

import { buildCookViewModel } from "./cook-view";

describe("cook view model", () => {
  it("uses rich imported recipe details for a single-day cooking view", () => {
    const view = buildCookViewModel({
      date: new Date("2026-04-28T00:00:00.000Z"),
      meal: {
        batchPrepNote: "Storage: Refrigerate leftovers.",
        budgetFit: true,
        costEstimateCents: 2650,
        diabetesFriendly: true,
        feedbackStatus: "PLANNED",
        heartHealthy: true,
        id: "meal_tuesday",
        ingredients: [
          {
            item: "boneless skinless chicken breast",
            pantryItem: false,
            preparation: "sliced into thin strips",
            quantity: "2.25 pounds",
          },
        ],
        kidAdaptations: "Serve the components separately.",
        kidFriendly: true,
        methodSteps: ["Fallback step"],
        name: "Fallback meal name",
        noFishSafe: true,
        prepTimeActiveMinutes: 20,
        prepTimeTotalMinutes: 45,
        servings: 5,
        sourceRecipe: {
          difficulty: "easy",
          dinner_title:
            "Sheet Pan Chicken Fajitas with Brown Rice and Build-Your-Own Toppings",
          equipment: ["2 large rimmed sheet pans", "mixing bowl"],
          health_adjustment: {
            changes: ["Choose a bowl or lettuce plate instead of multiple tortillas."],
            plate_build: "Build a bowl with chicken, peppers, brown rice, and romaine.",
            why_it_helps: ["Measured grains help manage the total carbohydrate load."],
          },
          instructions: [
            {
              heat: "425 degrees Fahrenheit",
              step: 2,
              text: "Roast until the chicken reaches 165 degrees Fahrenheit.",
              time_minutes: 20,
            },
            {
              heat: "none",
              step: 1,
              text: "Toss chicken, peppers, onions, oil, spices, and lime.",
              time_minutes: 5,
            },
          ],
          kid_friendly_variation: {
            notes: ["Keep hot sauce only on the table."],
            strategy: "Serve chicken, rice, and toppings in separate bowls.",
          },
          leftovers: {
            reuse_ideas: ["Serve over lettuce for taco salad."],
            storage: "Refrigerate chicken and vegetables for up to 4 days.",
          },
          nutrition_estimate_per_serving: {
            calories: 560,
            protein_g: 49,
            sodium_mg: 720,
          },
          serving_notes: ["Warm tortillas in a damp towel."],
          tags: ["sheet-pan", "build-your-own", "mild"],
          time: {
            prep_minutes: 20,
            total_minutes: 45,
          },
          why_this_works:
            "Roasting chicken, peppers, and onions on hot sheet pans gives fajita flavor.",
        },
        weeknightTimeSafe: true,
      },
      week: {
        id: "week_1",
        title: "Flexible family dinners",
      },
      weekDays: [
        {
          date: new Date("2026-04-27T00:00:00.000Z"),
          mealId: "meal_monday",
          mealName: "Quesadillas",
        },
        {
          date: new Date("2026-04-28T00:00:00.000Z"),
          mealId: "meal_tuesday",
          mealName:
            "Sheet Pan Chicken Fajitas with Brown Rice and Build-Your-Own Toppings",
        },
        {
          date: new Date("2026-04-30T00:00:00.000Z"),
          mealId: "meal_thursday",
          mealName: "Stir-Fry",
        },
      ],
    });

    expect(view.title).toBe(
      "Sheet Pan Chicken Fajitas with Brown Rice and Build-Your-Own Toppings",
    );
    expect(view.ingredients).toEqual([
      {
        id: "boneless-skinless-chicken-breast-2-25-pounds",
        name: "boneless skinless chicken breast",
        pantryItem: false,
        preparation: "sliced into thin strips",
        quantity: "2.25 pounds",
        substitutes: [],
      },
    ]);
    expect(view.steps.map((step) => step.text)).toEqual([
      "Toss chicken, peppers, onions, oil, spices, and lime.",
      "Roast until the chicken reaches 165 degrees Fahrenheit.",
    ]);
    expect(view.steps[0]).toMatchObject({
      heat: "none",
      timeMinutes: 5,
    });
    expect(view.equipment).toEqual(["2 large rimmed sheet pans", "mixing bowl"]);
    expect(view.health.plateBuild).toContain("Build a bowl");
    expect(view.kid.strategy).toBe(
      "Serve chicken, rice, and toppings in separate bowls.",
    );
    expect(view.nutrition).toContainEqual({
      key: "protein_g",
      label: "Protein",
      value: "49 g",
    });
    expect(view.previousMeal?.href).toBe("/cook/meal_monday");
    expect(view.nextMeal?.href).toBe("/cook/meal_thursday");
  });
});
