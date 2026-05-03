import { describe, expect, it } from "vitest";

import {
  buildSmartGrocerySuggestions,
  mergeSmartGrocerySelections,
} from "./smart-grocery";

describe("smart grocery suggestions", () => {
  it("suggests missing current items, recurring additions, and pantry candidates", () => {
    const suggestions = buildSmartGrocerySuggestions({
      derivedSections: [
        {
          items: [
            { item: "chicken breast", quantity: "2 pound" },
            { item: "brown rice", quantity: "3 cup" },
          ],
          name: "To buy",
        },
      ],
      pantryStaples: [
        {
          active: true,
          canonicalName: "olive oil",
          displayName: "Olive oil",
        },
      ],
      recentGrocerySections: [
        [
          {
            items: [{ item: "whole milk", quantity: "1 gallon" }],
            name: "Dairy",
          },
        ],
        [
          {
            items: [
              { item: "Whole milk", quantity: "1 gallon" },
              { item: "olive oil", quantity: "1 bottle" },
            ],
            name: "Dairy",
          },
        ],
        [
          {
            items: [{ item: "bananas", quantity: "1 bunch" }],
            name: "Produce",
          },
        ],
      ],
      shoppingItemStates: [
        {
          canonicalName: "garlic",
          itemName: "Garlic",
          quantity: "1 head",
          status: "ALREADY_HAVE",
        },
        {
          canonicalName: "garlic",
          itemName: "garlic",
          quantity: "1 head",
          status: "ALREADY_HAVE",
        },
        {
          canonicalName: "garlic",
          itemName: "Garlic cloves",
          quantity: null,
          status: "ALREADY_HAVE",
        },
        {
          canonicalName: "whole milk",
          itemName: "whole milk",
          quantity: "1 gallon",
          status: "BOUGHT",
        },
      ],
      storedSections: [
        {
          items: [{ item: "chicken breasts", quantity: "2 pound" }],
          name: "Imported",
        },
      ],
    });

    expect(suggestions.currentPlanMissing).toEqual([
      {
        canonicalName: "brown rice",
        itemName: "brown rice",
        quantity: "3 cup",
        reason: "Needed by the current planned dinners.",
      },
    ]);
    expect(suggestions.recurringAdditions).toEqual([
      {
        canonicalName: "milk",
        frequency: 2,
        itemName: "whole milk",
        quantity: "1 gallon",
        reason: "Appeared on 2 recent grocery lists.",
      },
    ]);
    expect(suggestions.pantryCandidates).toEqual([
      {
        canonicalName: "garlic",
        frequency: 3,
        itemName: "Garlic",
        reason: "Marked already on hand 3 times.",
      },
    ]);
  });

  it("merges only accepted suggestions into the stored grocery list", () => {
    const suggestions = buildSmartGrocerySuggestions({
      derivedSections: [
        {
          items: [
            { item: "chicken breast", quantity: "2 pound" },
            { item: "brown rice", quantity: "3 cup" },
          ],
          name: "To buy",
        },
      ],
      pantryStaples: [],
      recentGrocerySections: [
        [
          {
            items: [{ item: "whole milk", quantity: "1 gallon" }],
            name: "Dairy",
          },
        ],
        [
          {
            items: [{ item: "whole milk", quantity: "1 gallon" }],
            name: "Dairy",
          },
        ],
      ],
      shoppingItemStates: [],
      storedSections: [
        {
          items: [{ item: "chicken breast", quantity: "2 pound" }],
          name: "Imported",
        },
      ],
    });

    expect(
      mergeSmartGrocerySelections({
        acceptedCanonicalNames: ["brown rice", "milk"],
        smartSuggestions: suggestions,
        storedSections: [
          {
            items: [{ item: "chicken breast", quantity: "2 pound" }],
            name: "Imported",
          },
        ],
      }),
    ).toEqual([
      {
        items: [{ item: "chicken breast", quantity: "2 pound" }],
        name: "Imported",
      },
      {
        items: [
          { item: "brown rice", quantity: "3 cup" },
          { item: "whole milk", quantity: "1 gallon" },
        ],
        name: "Smart additions",
      },
    ]);
  });
});
