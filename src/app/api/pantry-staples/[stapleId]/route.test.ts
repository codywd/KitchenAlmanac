import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    actorUserId?: string;
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
    user: null | { id: string };
  },
  staple: { active: false, displayName: "Olive Oil", familyId: "family_1", id: "staple_1" },
}));

const service = vi.hoisted(() => ({
  setPantryStapleActiveForFamily: vi.fn(async () => routeState.staple),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
  getAuthenticatedActorUserId: vi.fn((auth: typeof routeState.auth) =>
    auth?.actorUserId ?? auth?.user?.id ?? null,
  ),
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );

  return {
    ...actual,
    assertRateLimit: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/pantry-staples", () => service);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const params = { params: Promise.resolve({ stapleId: "staple_1" }) };

describe("PATCH /api/pantry-staples/[stapleId]", () => {
  beforeEach(() => {
    routeState.auth = {
      actorUserId: "user_key_creator",
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
      user: null,
    };
    service.setPantryStapleActiveForFamily.mockClear();
  });

  it("activates or deactivates a pantry staple", async () => {
    const response = await PATCH(
      new Request("http://local.test/api/pantry-staples/staple_1", {
        body: JSON.stringify({ active: false }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.setPantryStapleActiveForFamily).toHaveBeenCalledWith({
      active: false,
      familyId: "family_1",
      stapleId: "staple_1",
      userId: "user_key_creator",
    });
    expect(body.pantryStaple).toEqual(routeState.staple);
  });
});
