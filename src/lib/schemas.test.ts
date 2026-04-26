import { describe, expect, it } from "vitest";

import {
  familyMemberCreateSchema,
  familyMemberPasswordResetSchema,
  familyMemberRemoveSchema,
  mealVoteSchema,
  pantryStapleCreateSchema,
  pantryStapleDeactivateSchema,
  passwordChangeSchema,
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
  });
});
