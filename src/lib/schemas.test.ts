import { describe, expect, it } from "vitest";

import {
  familyMemberCreateSchema,
  familyMemberPasswordResetSchema,
  familyMemberRemoveSchema,
  householdDocumentUpsertSchema,
  mealOutcomeSchema,
  mealVoteSchema,
  pantryStapleCreateSchema,
  pantryStapleDeactivateSchema,
  pantryStaplePatchSchema,
  passwordChangeSchema,
  savedRecipeCreateSchema,
  savedRecipePatchSchema,
  savedRecipeSwapSchema,
  shoppingItemStatusUpdateSchema,
} from "./schemas";

describe("multi-user schemas", () => {
  it("normalizes family-member email and accepts the managed roles", () => {
    const parsed = familyMemberCreateSchema.parse({
      email: "NEW@EXAMPLE.LOCAL",
      name: "New Person",
      password: "temporary-password",
      role: "ADMIN",
    });

    expect(parsed.email).toBe("new@example.local");
    expect(parsed.role).toBe("ADMIN");
  });

  it("validates member reset and removal forms", () => {
    expect(
      familyMemberPasswordResetSchema.safeParse({
        memberId: "member_1",
        password: "temporary-password",
      }).success,
    ).toBe(true);
    expect(
      familyMemberPasswordResetSchema.safeParse({
        memberId: "member_1",
        password: "short",
      }).success,
    ).toBe(false);
    expect(
      familyMemberRemoveSchema.parse({
        memberId: "member_1",
      }),
    ).toEqual({
      memberId: "member_1",
    });
  });

  it("validates meal votes and password changes", () => {
    expect(
      mealVoteSchema.parse({
        comment: "Sounds good",
        mealId: "meal_1",
        vote: "WANT",
      }),
    ).toMatchObject({
      comment: "Sounds good",
      mealId: "meal_1",
      vote: "WANT",
    });

    expect(
      passwordChangeSchema.safeParse({
        currentPassword: "old",
        newPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("validates shopping status and pantry staple forms", () => {
    expect(
      shoppingItemStatusUpdateSchema.parse({
        itemName: "Brown rice",
        quantity: "3 cup",
        status: "BOUGHT",
        weekId: "week_1",
      }),
    ).toMatchObject({
      itemName: "Brown rice",
      quantity: "3 cup",
      status: "BOUGHT",
      weekId: "week_1",
    });
    expect(
      shoppingItemStatusUpdateSchema.safeParse({
        itemName: "Brown rice",
        status: "MAYBE",
        weekId: "week_1",
      }).success,
    ).toBe(false);
    expect(pantryStapleCreateSchema.parse({ displayName: "Olive oil" })).toEqual({
      displayName: "Olive oil",
    });
    expect(pantryStapleDeactivateSchema.parse({ stapleId: "staple_1" })).toEqual({
      stapleId: "staple_1",
    });
    expect(pantryStaplePatchSchema.parse({ active: false })).toEqual({
      active: false,
    });
  });

  it("validates planner API document and recipe payloads", () => {
    expect(
      householdDocumentUpsertSchema.parse({
        content: "Keep weeknights easy.",
        title: "Household Profile",
      }),
    ).toEqual({
      content: "Keep weeknights easy.",
      title: "Household Profile",
    });

    expect(
      savedRecipeCreateSchema.parse({
        ingredients: [{ item: "Brown rice", quantity: "2 cups" }],
        methodSteps: ["Cook rice."],
        name: "Rice Bowls",
      }),
    ).toMatchObject({
      active: true,
      ingredients: [{ item: "Brown rice", quantity: "2 cups" }],
      methodSteps: ["Cook rice."],
      name: "Rice Bowls",
      servings: 7,
    });

    expect(
      savedRecipePatchSchema.parse({
        active: false,
        validation: {
          budgetFit: true,
        },
      }),
    ).toEqual({
      active: false,
      validation: {
        budgetFit: true,
      },
    });

    expect(savedRecipeSwapSchema.parse({ recipeId: "recipe_1" })).toEqual({
      recipeId: "recipe_1",
    });
  });

  it("validates meal closeout API payloads with cent amounts", () => {
    expect(
      mealOutcomeSchema.parse({
        actualCostCents: 1875,
        feedbackReason: "Everyone liked it.",
        feedbackStatus: "LIKED",
        outcomeStatus: "COOKED",
      }),
    ).toMatchObject({
      actualCostCents: 1875,
      feedbackReason: "Everyone liked it.",
      feedbackStatus: "LIKED",
      outcomeStatus: "COOKED",
    });

    expect(
      mealOutcomeSchema.safeParse({
        actualCostCents: -1,
        feedbackStatus: "LIKED",
        outcomeStatus: "COOKED",
      }).success,
    ).toBe(false);
  });
});
