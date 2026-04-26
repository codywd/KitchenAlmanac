import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
  },
  documents: [
    {
      content: "Keep it easy.",
      familyId: "family_1",
      id: "doc_1",
      kind: "HOUSEHOLD_PROFILE",
      title: "Household Profile",
    },
  ],
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/household-documents", () => ({
  listHouseholdDocumentsForFamily: vi.fn(async () => routeState.documents),
}));

describe("GET /api/household-documents", () => {
  beforeEach(() => {
    routeState.auth = {
      family: { id: "family_1", name: "Test Family" },
      role: "MEMBER",
    };
  });

  it("requires authentication", async () => {
    routeState.auth = null;

    const response = await GET(new Request("http://local.test/api/household-documents"));

    expect(response.status).toBe(401);
  });

  it("lists household documents for the caller family", async () => {
    const response = await GET(new Request("http://local.test/api/household-documents"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.documents).toEqual(routeState.documents);
  });
});
