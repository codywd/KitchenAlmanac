import { describe, expect, it } from "vitest";

import { aggregateIngredientsForWeek } from "./ingredients";

describe("ingredient aggregation", () => {
  it("normalizes ingredient names and totals matching units across daily recipes", () => {
    const result = aggregateIngredientsForWeek([
      {
        date: new Date("2026-04-27T00:00:00.000Z"),
        mealName: "Quesadillas",
        ingredients: [
          { item: "yellow onions", quantity: "2 medium" },
          { item: "bell peppers", quantity: "3 large" },
          { item: "low-sodium black beans", quantity: "2 15-ounce cans" },
        ],
      },
      {
        date: new Date("2026-04-28T00:00:00.000Z"),
        mealName: "Fajitas",
        ingredients: [
          { item: "yellow onion", quantity: "1 medium" },
          { item: "bell pepper", quantity: "1 large" },
          { item: "black beans", quantity: "1 15-ounce can" },
          { item: "fresh cilantro", quantity: "as needed" },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        canonicalName: "bell pepper",
        days: [
          {
            date: new Date("2026-04-27T00:00:00.000Z"),
            displayQuantity: "3 large",
            mealName: "Quesadillas",
          },
          {
            date: new Date("2026-04-28T00:00:00.000Z"),
            displayQuantity: "1 large",
            mealName: "Fajitas",
          },
        ],
        displayTotal: "4 large",
        pantryItem: false,
      },
      {
        canonicalName: "black beans",
        days: [
          {
            date: new Date("2026-04-27T00:00:00.000Z"),
            displayQuantity: "2 15-ounce can",
            mealName: "Quesadillas",
          },
          {
            date: new Date("2026-04-28T00:00:00.000Z"),
            displayQuantity: "1 15-ounce can",
            mealName: "Fajitas",
          },
        ],
        displayTotal: "3 15-ounce can",
        pantryItem: false,
      },
      {
        canonicalName: "cilantro",
        days: [
          {
            date: new Date("2026-04-28T00:00:00.000Z"),
            displayQuantity: "as needed",
            mealName: "Fajitas",
          },
        ],
        displayTotal: "as needed",
        pantryItem: false,
      },
      {
        canonicalName: "onion",
        days: [
          {
            date: new Date("2026-04-27T00:00:00.000Z"),
            displayQuantity: "2 medium",
            mealName: "Quesadillas",
          },
          {
            date: new Date("2026-04-28T00:00:00.000Z"),
            displayQuantity: "1 medium",
            mealName: "Fajitas",
          },
        ],
        displayTotal: "3 medium",
        pantryItem: false,
      },
    ]);
  });
});
