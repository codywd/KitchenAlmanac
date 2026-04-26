import { describe, expect, it } from "vitest";

import {
  buildGrocerySectionsFromIngredients,
  reconcileGroceryList,
} from "./grocery-reconciliation";

describe("grocery reconciliation", () => {
  it("builds grocery sections from derived ingredients split by pantry status", () => {
    const sections = buildGrocerySectionsFromIngredients([
      {
        canonicalName: "chicken breast",
        days: [
          {
            date: new Date("2026-05-04T00:00:00.000Z"),
            displayQuantity: "2 pound",
            mealName: "Lemon Chicken",
          },
        ],
        displayTotal: "2 pound",
        pantryItem: false,
      },
      {
        canonicalName: "olive oil",
        days: [
          {
            date: new Date("2026-05-04T00:00:00.000Z"),
            displayQuantity: "2 tablespoon",
            mealName: "Lemon Chicken",
          },
          {
            date: new Date("2026-05-05T00:00:00.000Z"),
            displayQuantity: "1 tablespoon",
            mealName: "Turkey Bowls",
          },
        ],
        displayTotal: "3 tablespoon",
        pantryItem: true,
      },
    ]);

    expect(sections).toEqual([
      {
        items: [
          {
            item: "chicken breast",
            pantryItem: false,
            quantity: "2 pound",
            usedInRecipes: ["Lemon Chicken"],
          },
        ],
        name: "To buy",
      },
      {
        items: [
          {
            item: "olive oil",
            pantryItem: true,
            quantity: "3 tablespoon",
            usedInRecipes: ["Lemon Chicken", "Turkey Bowls"],
          },
        ],
        name: "Pantry / on hand",
      },
    ]);
  });

  it("reports all derived groceries as added when no stored list exists", () => {
    const reconciliation = reconcileGroceryList({
      derivedSections: [
        {
          items: [
            { item: "chicken breast", quantity: "2 pound" },
            { item: "brown rice", quantity: "3 cup" },
          ],
          name: "To buy",
        },
      ],
      storedSections: null,
    });

    expect(reconciliation).toMatchObject({
      added: [
        { item: "brown rice", quantity: "3 cup" },
        { item: "chicken breast", quantity: "2 pound" },
      ],
      derivedItemCount: 2,
      hasChanges: true,
      quantityChanged: [],
      removed: [],
      storedItemCount: 0,
      unchangedCount: 0,
    });
  });

  it("detects added, removed, unchanged, and quantity-changed groceries by normalized name", () => {
    const reconciliation = reconcileGroceryList({
      derivedSections: [
        {
          items: [
            { item: "onion", quantity: "2 medium" },
            { item: "chicken breast", quantity: "1 pound" },
            { item: "bell pepper", quantity: "3 large" },
          ],
          name: "To buy",
        },
      ],
      storedSections: [
        {
          items: [
            { item: "Yellow onions", quantity: "1 medium" },
            { item: "chicken breasts", quantity: "1 pound" },
            { item: "old salsa", quantity: "1 jar" },
          ],
          name: "Imported",
        },
      ],
    });

    expect(reconciliation.added).toEqual([
      { canonicalName: "bell pepper", item: "bell pepper", quantity: "3 large" },
    ]);
    expect(reconciliation.removed).toEqual([
      { canonicalName: "old salsa", item: "old salsa", quantity: "1 jar" },
    ]);
    expect(reconciliation.quantityChanged).toEqual([
      {
        canonicalName: "onion",
        item: "onion",
        nextQuantity: "2 medium",
        previousItem: "Yellow onions",
        previousQuantity: "1 medium",
      },
    ]);
    expect(reconciliation.unchangedCount).toBe(1);
    expect(reconciliation.hasChanges).toBe(true);
  });
});
