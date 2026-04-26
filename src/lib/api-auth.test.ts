import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashApiKey } from "./auth";
import { authenticateRequest } from "./api-auth";

const authState = vi.hoisted(() => ({
  db: null as ReturnType<typeof makeDb>["db"] | null,
  key: null as ReturnType<typeof apiKey> | null,
}));

vi.mock("./db", () => ({
  getDb: vi.fn(() => authState.db),
}));

vi.mock("./session", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

function apiKey({
  createdByUserId = "user_creator",
  role = "ADMIN" as "ADMIN" | "MEMBER" | "OWNER",
}: {
  createdByUserId?: string | null;
  role?: "ADMIN" | "MEMBER" | "OWNER" | null;
} = {}) {
  return {
    createdBy:
      createdByUserId && role
        ? {
            email: "creator@example.local",
            familyMembership: {
              familyId: "family_1",
              role,
            },
            id: createdByUserId,
            name: "Creator",
          }
        : null,
    createdByUserId,
    family: {
      id: "family_1",
      name: "Test Family",
    },
    familyId: "family_1",
    id: "key_1",
  };
}

function makeDb() {
  const db = {
    apiKey: {
      findFirst: vi.fn(async () => authState.key),
      update: vi.fn(async () => authState.key),
    },
  };

  return { db };
}

function requestWithApiKey(apiKeyText = "mp_test_secret") {
  return new Request("http://local.test/api/weeks", {
    headers: {
      authorization: `Bearer ${apiKeyText}`,
    },
  });
}

describe("authenticateRequest API-key auth", () => {
  beforeEach(() => {
    authState.key = apiKey();
    authState.db = makeDb().db;
  });

  it("accepts an unrevoked key created by a current family admin", async () => {
    const auth = await authenticateRequest(requestWithApiKey());

    expect(auth).toMatchObject({
      actorUserId: "user_creator",
      authType: "apiKey",
      family: {
        id: "family_1",
      },
      role: "ADMIN",
      user: {
        id: "user_creator",
      },
    });
    expect(authState.db?.apiKey.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          keyHash: hashApiKey("mp_test_secret"),
          revokedAt: null,
        }),
      }),
    );
    expect(authState.db?.apiKey.update).toHaveBeenCalledWith({
      data: {
        lastUsedAt: expect.any(Date),
      },
      where: {
        id: "key_1",
      },
    });
  });

  it("rejects keys whose creator no longer has family membership", async () => {
    authState.key = apiKey({ createdByUserId: null, role: null });

    await expect(authenticateRequest(requestWithApiKey())).resolves.toBeNull();
    expect(authState.db?.apiKey.update).not.toHaveBeenCalled();
  });

  it("rejects keys whose creator was demoted below admin", async () => {
    authState.key = apiKey({ role: "MEMBER" });

    await expect(authenticateRequest(requestWithApiKey())).resolves.toBeNull();
    expect(authState.db?.apiKey.update).not.toHaveBeenCalled();
  });

  it("rejects revoked or expired keys by relying on the key lookup filter", async () => {
    authState.key = null;

    await expect(authenticateRequest(requestWithApiKey())).resolves.toBeNull();
    expect(authState.db?.apiKey.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
          revokedAt: null,
        }),
      }),
    );
    expect(authState.db?.apiKey.update).not.toHaveBeenCalled();
  });
});
