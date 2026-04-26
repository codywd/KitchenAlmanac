import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    actorUserId?: string;
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
    user: null | { id: string };
  },
  staples: [{ active: true, displayName: "Olive Oil", familyId: "family_1", id: "staple_1" }],
}));

const service = vi.hoisted(() => ({
  listPantryStaplesForFamily: vi.fn(async () => routeState.staples),
  upsertPantryStapleForFamily: vi.fn(async () => routeState.staples[0]),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
  getAuthenticatedActorUserId: vi.fn((auth: typeof routeState.auth) =>
    auth?.actorUserId ?? auth?.user?.id ?? null,
  ),
}));

vi.mock("@/lib/pantry-staples", () => service);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function request(body: unknown) {
  return new Request("http://local.test/api/pantry-staples", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("pantry staples API", () => {
  beforeEach(() => {
    routeState.auth = {
      actorUserId: "user_key_creator",
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
      user: null,
    };
    service.listPantryStaplesForFamily.mockClear();
    service.upsertPantryStapleForFamily.mockClear();
  });

  it("lists pantry staples with active filter", async () => {
    const response = await GET(new Request("http://local.test/api/pantry-staples?active=false"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.listPantryStaplesForFamily).toHaveBeenCalledWith({
      active: "false",
      familyId: "family_1",
    });
    expect(body.pantryStaples).toEqual(routeState.staples);
  });

  it("upserts pantry staples with actor attribution", async () => {
    const response = await POST(request({ displayName: "Olive Oil" }));

    expect(response.status).toBe(201);
    expect(service.upsertPantryStapleForFamily).toHaveBeenCalledWith({
      displayName: "Olive Oil",
      familyId: "family_1",
      userId: "user_key_creator",
    });
  });
});
