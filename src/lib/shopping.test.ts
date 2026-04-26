import { describe, expect, it } from "vitest";

import { buildShoppingItems } from "./shopping";

describe("shopping item building", () => {
  it("uses stored grocery sections before derived ingredient fallback", () => {
    const items = buildShoppingItems({
      derivedSections: [
        {
          items: [{ item: "chicken breast", quantity: "2 pound" }],
          name: "To buy",
        },
      ],
      itemStates: [],
      pantryStaples: [],
      storedSections: [
        {
          items: [
            { item: "Yellow onions", quantity: "2 medium" },
            { item: "olive oil", pantryItem: true, quantity: "1 bottle" },
          ],
          name: "Imported",
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({
        canonicalName: "olive oil",
        itemName: "olive oil",
        quantity: "1 bottle",
        sectionName: "Imported",
        status: "ALREADY_HAVE",
      }),
      expect.objectContaining({
        canonicalName: "onion",
        itemName: "Yellow onions",
        quantity: "2 medium",
        sectionName: "Imported",
        status: "NEEDED",
      }),
    ]);
    expect(items.some((item) => item.canonicalName === "chicken breast")).toBe(
      false,
    );
  });

  it("applies pantry staples as defaults without overriding explicit week state", () => {
    const items = buildShoppingItems({
      derivedSections: [
        {
          items: [
            { item: "chicken breasts", quantity: "2 pound" },
            { item: "brown rice", quantity: "3 cup" },
          ],
          name: "To buy",
        },
      ],
      itemStates: [
        {
          canonicalName: "brown rice",
          itemName: "brown rice",
          quantity: "3 cup",
          status: "BOUGHT",
          updatedBy: {
            email: "member@example.local",
            name: "Member",
          },
        },
      ],
      pantryStaples: [
        {
          active: true,
          canonicalName: "chicken breast",
          displayName: "Chicken breast",
        },
      ],
      storedSections: null,
    });

    expect(items).toEqual([
      expect.objectContaining({
        canonicalName: "brown rice",
        status: "BOUGHT",
        updatedBy: {
          email: "member@example.local",
          name: "Member",
        },
      }),
      expect.objectContaining({
        canonicalName: "chicken breast",
        defaultedFromPantry: true,
        status: "ALREADY_HAVE",
      }),
    ]);
  });

  it("preserves matching state after a grocery refresh changes display names", () => {
    const items = buildShoppingItems({
      derivedSections: [
        {
          items: [{ item: "boneless skinless chicken breasts", quantity: "2 lb" }],
          name: "To buy",
        },
      ],
      itemStates: [
        {
          canonicalName: "chicken breast",
          itemName: "chicken breast",
          quantity: "2 pound",
          status: "BOUGHT",
          updatedBy: null,
        },
      ],
      pantryStaples: [],
      storedSections: null,
    });

    expect(items).toEqual([
      expect.objectContaining({
        canonicalName: "chicken breast",
        itemName: "boneless skinless chicken breasts",
        status: "BOUGHT",
      }),
    ]);
  });
});
