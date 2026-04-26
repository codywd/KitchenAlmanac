import { beforeEach, describe, expect, it, vi } from "vitest";

import { changePasswordAction } from "./account-actions";

const actionState = vi.hoisted(() => ({
  auditEvents: [] as unknown[],
  context: {
    family: {
      id: "family_1",
      name: "Test Family",
    },
    role: "OWNER" as "ADMIN" | "MEMBER" | "OWNER",
    user: {
      email: "owner@example.local",
      id: "user_owner",
      mustChangePassword: true,
      name: "Owner",
    },
  },
  db: null as ReturnType<typeof makeDb>["db"] | null,
  passwordMatches: true,
  replacedSessions: [] as string[],
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  verifyPassword: vi.fn(async () => actionState.passwordMatches),
}));

vi.mock("@/lib/audit", () => ({
  recordAuditEvent: vi.fn(async (event: unknown) => {
    actionState.auditEvents.push(event);
  }),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => actionState.db),
}));

vi.mock("@/lib/family", () => ({
  requireFamilyContext: vi.fn(async () => actionState.context),
}));

vi.mock("@/lib/request-context", () => ({
  getActionRequestMetadata: vi.fn(async () => ({ requestId: "req_1" })),
}));

vi.mock("@/lib/session", () => ({
  replaceSessionsForUser: vi.fn(async (userId: string) => {
    actionState.replacedSessions.push(userId);
  }),
}));

function makeDb() {
  const db = {
    user: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "user_owner",
        passwordHash: "hashed:old-password",
      })),
      update: vi.fn(async () => ({
        id: "user_owner",
      })),
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

describe("changePasswordAction", () => {
  beforeEach(() => {
    actionState.auditEvents = [];
    actionState.db = makeDb().db;
    actionState.passwordMatches = true;
    actionState.replacedSessions = [];
  });

  it("invalidates other sessions and clears forced-change state after password change", async () => {
    const result = await changePasswordAction(
      {},
      formData({
        currentPassword: "old-password",
        newPassword: "new-password",
      }),
    );

    expect(result).toEqual({
      message: "Password updated.",
    });
    expect(actionState.db?.user.update).toHaveBeenCalledWith({
      data: {
        mustChangePassword: false,
        passwordChangedAt: expect.any(Date),
        passwordHash: "hashed:new-password",
      },
      where: {
        id: "user_owner",
      },
    });
    expect(actionState.replacedSessions).toEqual(["user_owner"]);
    expect(actionState.auditEvents).toEqual([
      expect.objectContaining({
        outcome: "success",
        type: "auth.password_change",
      }),
    ]);
  });

  it("does not change the password when the current password fails", async () => {
    actionState.passwordMatches = false;

    const result = await changePasswordAction(
      {},
      formData({
        currentPassword: "wrong-password",
        newPassword: "new-password",
      }),
    );

    expect(result).toEqual({
      error: "Current password did not match.",
    });
    expect(actionState.db?.user.update).not.toHaveBeenCalled();
    expect(actionState.replacedSessions).toEqual([]);
    expect(actionState.auditEvents).toEqual([
      expect.objectContaining({
        outcome: "failure",
        type: "auth.password_change",
      }),
    ]);
  });
});
