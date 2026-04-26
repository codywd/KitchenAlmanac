import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
  },
  document: {
    content: "Updated.",
    familyId: "family_1",
    id: "doc_1",
    kind: "HOUSEHOLD_PROFILE",
    title: "Household Profile",
  },
}));

const service = vi.hoisted(() => ({
  upsertHouseholdDocumentForFamily: vi.fn(async () => routeState.document),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/household-documents", () => service);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function request(body: unknown) {
  return new Request("http://local.test/api/household-documents/HOUSEHOLD_PROFILE", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
}

const params = { params: Promise.resolve({ kind: "HOUSEHOLD_PROFILE" }) };

describe("PUT /api/household-documents/[kind]", () => {
  beforeEach(() => {
    routeState.auth = {
      family: { id: "family_1", name: "Test Family" },
      role: "ADMIN",
    };
    service.upsertHouseholdDocumentForFamily.mockClear();
  });

  it("forbids member callers", async () => {
    routeState.auth = {
      family: { id: "family_1", name: "Test Family" },
      role: "MEMBER",
    };

    const response = await PUT(request({ content: "Updated." }), params);

    expect(response.status).toBe(403);
  });

  it("upserts household guidance by kind", async () => {
    const response = await PUT(
      request({ content: "Updated.", title: "Household Profile" }),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.upsertHouseholdDocumentForFamily).toHaveBeenCalledWith({
      content: "Updated.",
      familyId: "family_1",
      kind: "HOUSEHOLD_PROFILE",
      title: "Household Profile",
    });
    expect(body.document).toEqual(routeState.document);
  });
});
