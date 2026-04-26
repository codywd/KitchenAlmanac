import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addPantryStapleAction,
  deactivatePantryStapleAction,
  setShoppingItemStatusAction,
} from "./shopping-actions";

const actionState = vi.hoisted(() => ({
  context: {
    family: {
      id: "family_1",
      name: "Test Family",
    },
    role: "OWNER" as "ADMIN" | "MEMBER" | "OWNER",
    user: {
      email: "owner@example.local",
      id: "user_owner",
      name: "Owner",
    },
  },
  db: null as ReturnType<typeof makeDb>["db"] | null,
  revalidated: [] as Array<[string, string | undefined]>,
}));

vi.mock("@/lib/family", async () => {
  const actual = await vi.importActual<typeof import("@/lib/family")>(
    "@/lib/family",
  );

  return {
    ...actual,
    requireFamilyContext: vi.fn(async () => actionState.context),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => actionState.db),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((path: string, type?: string) =>
    actionState.revalidated.push([path, type]),
  ),
}));

function makeDb({
  week = { id: "week_1" } as { id: string } | null,
}: {
  week?: { id: string } | null;
} = {}) {
  const db = {
    pantryStaple: {
      findFirst: vi.fn(async () => ({ id: "staple_1" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      upsert: vi.fn(async () => ({ id: "staple_1" })),
    },
    shoppingItemState: {
      upsert: vi.fn(async () => ({ id: "state_1" })),
    },
    week: {
      findFirst: vi.fn(async () => week),
    },
  };

  return { db };
}

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

describe("shopping actions", () => {
  beforeEach(() => {
    actionState.context.role = "OWNER";
    actionState.context.user.id = "user_owner";
    actionState.db = makeDb().db;
    actionState.revalidated = [];
  });

  it("lets members update shopping item status for their family week", async () => {
    actionState.context.role = "MEMBER";
    actionState.context.user.id = "user_member";
    const db = makeDb().db;
    actionState.db = db;

    const result = await setShoppingItemStatusAction(
      formData({
        itemName: "Yellow onions",
        quantity: "2 medium",
        status: "BOUGHT",
        weekId: "week_1",
      }),
    );

    expect(db.week.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        familyId: "family_1",
        id: "week_1",
      },
    });
    expect(db.shoppingItemState.upsert).toHaveBeenCalledWith({
      create: {
        canonicalName: "onion",
        familyId: "family_1",
        itemName: "Yellow onions",
        quantity: "2 medium",
        status: "BOUGHT",
        updatedByUserId: "user_member",
        weekId: "week_1",
      },
      include: {
        updatedBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      update: {
        itemName: "Yellow onions",
        quantity: "2 medium",
        status: "BOUGHT",
        updatedByUserId: "user_member",
      },
      where: {
        weekId_canonicalName: {
          canonicalName: "onion",
          weekId: "week_1",
        },
      },
    });
    expect(result).toEqual({ message: "Updated Yellow onions.", weekId: "week_1" });
    expect(actionState.revalidated).toContainEqual([
      "/weeks/week_1/shopping",
      undefined,
    ]);
  });

  it("rejects shopping status updates for out-of-family weeks and invalid payloads", async () => {
    actionState.db = makeDb({ week: null }).db;

    const missingWeek = await setShoppingItemStatusAction(
      formData({
        itemName: "Brown rice",
        status: "NEEDED",
        weekId: "week_2",
      }),
    );
    const invalidStatus = await setShoppingItemStatusAction(
      formData({
        itemName: "Brown rice",
        status: "MAYBE",
        weekId: "week_1",
      }),
    );

    expect(missingWeek.error).toBe("Week not found.");
    expect(invalidStatus.error).toBe("Choose a valid shopping status.");
  });

  it("lets owners and admins add pantry staples", async () => {
    actionState.context.role = "ADMIN";
    const db = makeDb().db;
    actionState.db = db;

    const result = await addPantryStapleAction(
      {},
      formData({ displayName: "Olive Oil" }),
    );

    expect(db.pantryStaple.upsert).toHaveBeenCalledWith({
      create: {
        active: true,
        canonicalName: "olive oil",
        createdByUserId: "user_owner",
        displayName: "Olive Oil",
        familyId: "family_1",
      },
      update: {
        active: true,
        createdByUserId: "user_owner",
        displayName: "Olive Oil",
      },
      where: {
        familyId_canonicalName: {
          canonicalName: "olive oil",
          familyId: "family_1",
        },
      },
    });
    expect(result).toEqual({ message: "Added Olive Oil to pantry staples." });
  });

  it("forbids members from managing pantry staples", async () => {
    actionState.context.role = "MEMBER";

    await expect(
      addPantryStapleAction({}, formData({ displayName: "Olive Oil" })),
    ).rejects.toThrow("Only family owners and admins can manage meal plans.");
  });

  it("deactivates pantry staples within the current family", async () => {
    const db = makeDb().db;
    actionState.db = db;

    await deactivatePantryStapleAction(
      formData({
        stapleId: "staple_1",
      }),
    );

    expect(db.pantryStaple.updateMany).toHaveBeenCalledWith({
      data: {
        active: false,
        deactivatedByUserId: "user_owner",
      },
      where: {
        familyId: "family_1",
        id: "staple_1",
      },
    });
  });
});
