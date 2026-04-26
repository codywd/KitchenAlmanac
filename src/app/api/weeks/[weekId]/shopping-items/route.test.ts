import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    actorUserId?: string;
    authType: "apiKey" | "session";
    family: {
      id: string;
      name: string;
    };
    role: "ADMIN" | "MEMBER" | "OWNER";
    user: null | {
      email: string;
      id: string;
      name: string | null;
    };
  },
  db: null as ReturnType<typeof makeDb>["db"] | null,
  revalidated: [] as Array<[string, string | undefined]>,
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => routeState.db),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((path: string, type?: string) =>
    routeState.revalidated.push([path, type]),
  ),
}));

function makeDb({
  week = { id: "week_1" } as { id: string } | null,
}: {
  week?: { id: string } | null;
} = {}) {
  const db = {
    shoppingItemState: {
      upsert: vi.fn(async () => ({
        canonicalName: "onion",
        itemName: "Yellow onions",
        quantity: "2 medium",
        status: "BOUGHT",
        updatedBy: {
          email: "member@example.local",
          name: "Member",
        },
      })),
    },
    week: {
      findFirst: vi.fn(async () => week),
    },
  };

  return { db };
}

function auth(role: "ADMIN" | "MEMBER" | "OWNER", authType = "session" as const) {
  return {
    actorUserId: `user_${role.toLowerCase()}`,
    authType,
    family: {
      id: "family_1",
      name: "Test Family",
    },
    role,
    user:
      authType === "session"
        ? {
            email: `${role.toLowerCase()}@example.local`,
            id: `user_${role.toLowerCase()}`,
            name: role === "MEMBER" ? "Member" : role,
          }
        : null,
  };
}

function request(body: unknown) {
  return new Request("http://local.test/api/weeks/week_1/shopping-items", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
}

const params = { params: Promise.resolve({ weekId: "week_1" }) };

describe("POST /api/weeks/[weekId]/shopping-items", () => {
  beforeEach(() => {
    routeState.auth = auth("MEMBER");
    routeState.db = makeDb().db;
    routeState.revalidated = [];
  });

  it("requires a signed-in family member session", async () => {
    routeState.auth = null;

    const response = await POST(request({}), params);

    expect(response.status).toBe(401);
  });

  it("rejects API-key callers because shopping sync is a member action", async () => {
    routeState.auth = auth("ADMIN", "apiKey");

    const response = await POST(
      request({
        itemName: "Yellow onions",
        status: "BOUGHT",
      }),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Shopping updates require a signed-in family member.");
  });

  it("lets members sync status changes for their family week", async () => {
    const response = await POST(
      request({
        canonicalName: "yellow onions",
        itemName: "Yellow onions",
        quantity: "2 medium",
        status: "BOUGHT",
      }),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(routeState.db?.week.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        familyId: "family_1",
        id: "week_1",
      },
    });
    expect(routeState.db?.shoppingItemState.upsert).toHaveBeenCalledWith({
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
    expect(body.shoppingItemState).toEqual({
      canonicalName: "onion",
      itemName: "Yellow onions",
      quantity: "2 medium",
      status: "BOUGHT",
      updatedBy: {
        email: "member@example.local",
        name: "Member",
      },
    });
    expect(routeState.revalidated).toContainEqual([
      "/weeks/week_1/shopping",
      undefined,
    ]);
  });

  it("rejects out-of-family weeks and invalid payloads", async () => {
    routeState.db = makeDb({ week: null }).db;

    const missingWeek = await POST(
      request({
        itemName: "Yellow onions",
        status: "BOUGHT",
      }),
      params,
    );
    const invalid = await POST(
      request({
        itemName: "Yellow onions",
        status: "MAYBE",
      }),
      params,
    );

    expect(missingWeek.status).toBe(404);
    expect(await missingWeek.json()).toEqual({ error: "Week not found." });
    expect(invalid.status).toBe(400);
  });
});
