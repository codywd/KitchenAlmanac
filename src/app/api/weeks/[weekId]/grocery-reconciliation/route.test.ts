import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
  },
  result: {
    derivedSections: [{ items: [{ item: "rice", quantity: "2 cup" }], name: "To buy" }],
    reconciliation: { added: [], hasChanges: false, quantityChanged: [], removed: [] },
    storedSections: [],
    weekId: "week_1",
  },
}));

const service = vi.hoisted(() => ({
  getGroceryReconciliationForFamilyWeek: vi.fn(async () => routeState.result),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/grocery-api", () => service);

const params = { params: Promise.resolve({ weekId: "week_1" }) };

describe("GET /api/weeks/[weekId]/grocery-reconciliation", () => {
  beforeEach(() => {
    routeState.auth = {
      family: { id: "family_1", name: "Test Family" },
      role: "MEMBER",
    };
    service.getGroceryReconciliationForFamilyWeek.mockClear();
  });

  it("returns derived grocery sections and reconciliation", async () => {
    const response = await GET(
      new Request("http://local.test/api/weeks/week_1/grocery-reconciliation"),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.getGroceryReconciliationForFamilyWeek).toHaveBeenCalledWith({
      familyId: "family_1",
      weekId: "week_1",
    });
    expect(body).toEqual(routeState.result);
  });
});
