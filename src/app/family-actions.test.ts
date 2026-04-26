import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addFamilyMemberAction,
  removeFamilyMemberAction,
  updateFamilyMemberRoleAction,
} from "./family-actions";

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
  revalidated: [] as string[],
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");

  return {
    ...actual,
    hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  };
});

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
  revalidatePath: vi.fn((path: string) => actionState.revalidated.push(path)),
}));

function makeDb({
  existingUser = null as null | {
    email: string;
    familyMembership: null | { familyId: string };
    id: string;
    name: string | null;
    passwordHash: string;
  },
  member = {
    id: "member_admin",
    role: "ADMIN" as "ADMIN" | "MEMBER" | "OWNER",
    user: {
      id: "user_admin",
    },
    userId: "user_admin",
  },
} = {}) {
  const tx = {
    apiKey: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    familyMember: {
      create: vi.fn(async () => ({ id: "member_new" })),
      delete: vi.fn(async () => member),
      findFirstOrThrow: vi.fn(async () => member),
      update: vi.fn(async () => ({ ...member, role: "MEMBER" })),
    },
    mealVote: {
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    session: {
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    user: {
      create: vi.fn(async () => ({
        email: "new@example.local",
        id: "user_new",
        name: "New Person",
        passwordHash: "hashed:temporary-password",
      })),
      findUnique: vi.fn(async () => existingUser),
      update: vi.fn(async () => ({
        ...existingUser,
        name: "Existing Person",
        passwordHash: "hashed:new-temporary-password",
      })),
    },
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    familyMember: {
      ...tx.familyMember,
      count: vi.fn(async () => 2),
    },
  };

  return { db, tx };
}

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

describe("family member actions", () => {
  beforeEach(() => {
    actionState.context.role = "OWNER";
    actionState.db = makeDb().db;
    actionState.revalidated = [];
  });

  it("updates the temporary password when re-adding an existing user", async () => {
    const { db, tx } = makeDb({
      existingUser: {
        email: "existing@example.local",
        familyMembership: null,
        id: "user_existing",
        name: "Old Name",
        passwordHash: "old-hash",
      },
    });
    actionState.db = db;

    const result = await addFamilyMemberAction(
      {},
      formData({
        email: "existing@example.local",
        name: "Existing Person",
        password: "new-temporary-password",
        role: "MEMBER",
      }),
    );

    expect(result.error).toBeUndefined();
    expect(tx.user.update).toHaveBeenCalledWith({
      data: {
        name: "Existing Person",
        mustChangePassword: true,
        passwordHash: "hashed:new-temporary-password",
      },
      where: {
        id: "user_existing",
      },
    });
    expect(tx.familyMember.create).toHaveBeenCalledWith({
      data: {
        familyId: "family_1",
        role: "MEMBER",
        userId: "user_existing",
      },
    });
  });

  it("revokes active API keys when a member is demoted below admin", async () => {
    const { db, tx } = makeDb();
    actionState.db = db;

    await updateFamilyMemberRoleAction(
      formData({
        memberId: "member_admin",
        role: "MEMBER",
      }),
    );

    expect(tx.apiKey.updateMany).toHaveBeenCalledWith({
      data: {
        revokedAt: expect.any(Date),
      },
      where: {
        createdByUserId: "user_admin",
        familyId: "family_1",
        revokedAt: null,
      },
    });
  });

  it("revokes active API keys when removing a family member", async () => {
    const { db, tx } = makeDb();
    actionState.db = db;

    await removeFamilyMemberAction(
      formData({
        memberId: "member_admin",
      }),
    );

    expect(tx.apiKey.updateMany).toHaveBeenCalledWith({
      data: {
        revokedAt: expect.any(Date),
      },
      where: {
        createdByUserId: "user_admin",
        familyId: "family_1",
        revokedAt: null,
      },
    });
    expect(tx.familyMember.delete).toHaveBeenCalledWith({
      where: {
        id: "member_admin",
      },
    });
  });
});
