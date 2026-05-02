import { describe, expect, it } from "vitest";

import {
  firstRouteParam,
  routeParamValues,
  routeWithParams,
} from "@/lib/routed-menu";

describe("routed menu helpers", () => {
  it("reads scalar and repeated route params", () => {
    expect(firstRouteParam("edit")).toBe("edit");
    expect(firstRouteParam(["swap", "edit"])).toBe("swap");
    expect(routeParamValues(["budgetFit", "", "kidFriendly"])).toEqual([
      "budgetFit",
      "kidFriendly",
    ]);
    expect(routeParamValues(undefined)).toEqual([]);
  });

  it("builds deep links while preserving unrelated filters", () => {
    expect(
      routeWithParams(
        "/recipes",
        {
          active: "all",
          flag: ["budgetFit", "kidFriendly"],
          menu: "old",
          q: "rice",
          recipeId: "old-recipe",
        },
        {
          menu: "edit",
          recipeId: "recipe_123",
        },
        "recipe-recipe_123-edit",
      ),
    ).toBe(
      "/recipes?active=all&flag=budgetFit&flag=kidFriendly&q=rice&menu=edit&recipeId=recipe_123#recipe-recipe_123-edit",
    );
  });
});
