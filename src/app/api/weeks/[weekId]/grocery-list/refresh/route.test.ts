import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
  },
  result: {
    groceryList: { id: "grocery_1", weekId: "week_1" },
    itemCount: 1,
    message: "Refreshed grocery list from 1 current ingredient.",
    weekId: "week_1",
  },
}));

const service = vi.hoisted(() => ({
  refreshGroceryListForFamilyWeek: vi.fn(async () => routeState.result),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/grocery-api", () => service);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const params = { params: Promise.resolve({ weekId: "week_1" }) };

describe("POST /api/weeks/[weekId]/grocery-list/refresh", () => {
  beforeEach(() => {
    routeState.auth = {
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
    };
    service.refreshGroceryListForFamilyWeek.mockClear();
  });

  it("forbids members from refreshing the stored grocery list", async () => {
    routeState.auth = {
      family: { id: "family_1", name: "Test Family" },
      role: "MEMBER",
    };

    const response = await POST(
      new Request("http://local.test/api/weeks/week_1/grocery-list/refresh", {
        method: "POST",
      }),
      params,
    );

    expect(response.status).toBe(403);
  });

  it("refreshes the stored grocery list from current meals", async () => {
    const response = await POST(
      new Request("http://local.test/api/weeks/week_1/grocery-list/refresh", {
        method: "POST",
      }),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.refreshGroceryListForFamilyWeek).toHaveBeenCalledWith({
      familyId: "family_1",
      weekId: "week_1",
    });
    expect(body).toEqual(routeState.result);
  });
});
