import { describe, expect, it } from "vitest";

import { filterSavedRecipes } from "./saved-recipe-filters";

const recipes = [
  {
    active: true,
    budgetFit: true,
    cuisine: "Mexican",
    diabetesFriendly: true,
    heartHealthy: false,
    ingredients: [{ item: "Ground turkey", quantity: "2 lb" }],
    kidFriendly: true,
    name: "Turkey Rice Bowls",
    noFishSafe: true,
    tags: ["weeknight", "kid favorite"],
    weeknightTimeSafe: true,
  },
  {
    active: true,
    budgetFit: false,
    cuisine: "Italian",
    diabetesFriendly: false,
    heartHealthy: true,
    ingredients: [{ item: "Pasta", quantity: "1 lb" }],
    kidFriendly: false,
    name: "Lemony Pasta",
    noFishSafe: true,
    tags: ["date night"],
    weeknightTimeSafe: false,
  },
  {
    active: false,
    budgetFit: true,
    cuisine: "American",
    diabetesFriendly: false,
    heartHealthy: false,
    ingredients: [{ item: "Beans", quantity: "2 cans" }],
    kidFriendly: true,
    name: "Archived Bean Chili",
    noFishSafe: true,
    tags: ["freezer"],
    weeknightTimeSafe: true,
  },
];

describe("saved recipe filters", () => {
  it("filters recipes by active state, query text, tags, cuisines, and flags", () => {
    const filtered = filterSavedRecipes(recipes, {
      active: "true",
      cuisines: ["Mexican"],
      flags: ["kidFriendly", "budgetFit"],
      query: "turkey",
      tags: ["weeknight"],
    });

    expect(filtered.map((recipe) => recipe.name)).toEqual(["Turkey Rice Bowls"]);
  });

  it("can include archived recipes and match ingredient text", () => {
    const filtered = filterSavedRecipes(recipes, {
      active: "all",
      query: "beans",
    });

    expect(filtered.map((recipe) => recipe.name)).toEqual(["Archived Bean Chili"]);
  });
});
