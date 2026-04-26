import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const routeState = vi.hoisted(() => ({
  auth: null as null | {
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
  context: {
    activeRejectedMeals: [],
    familyMembers: [
      {
        email: "owner@example.local",
        name: "Owner",
        role: "OWNER",
      },
    ],
    householdDocuments: [],
    pantryStaples: [],
    savedRecipes: [],
    recentGrocerySummaries: [],
    recentIngredientSignals: [],
    recentMeals: [],
    recentVotes: [],
  },
  latestBudgetTargetCents: 35000,
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/planning-brief", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planning-brief")>(
    "@/lib/planning-brief",
  );

  return {
    ...actual,
    getLatestFamilyBudgetTargetCents: vi.fn(
      async () => routeState.latestBudgetTargetCents,
    ),
    loadPlanningBriefContext: vi.fn(async () => routeState.context),
  };
});

function auth(role: "ADMIN" | "MEMBER" | "OWNER", authType = "session" as const) {
  return {
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
            name: role,
          }
        : null,
  };
}

describe("GET /api/planning-brief", () => {
  beforeEach(() => {
    routeState.auth = null;
    routeState.latestBudgetTargetCents = 35000;
  });

  it("requires authentication", async () => {
    const response = await GET(new Request("http://local.test/api/planning-brief"));

    expect(response.status).toBe(401);
  });

  it("forbids member session callers", async () => {
    routeState.auth = auth("MEMBER");

    const response = await GET(new Request("http://local.test/api/planning-brief"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Only family owners and admins can generate planning briefs.");
  });

  it("allows owner session callers and parses query parameters", async () => {
    routeState.auth = auth("OWNER");

    const response = await GET(
      new Request(
        "http://local.test/api/planning-brief?weekStart=2026-05-04&budgetTargetCents=27500",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.weekStart).toBe("2026-05-04");
    expect(body.weekEnd).toBe("2026-05-10");
    expect(body.briefMarkdown).toContain("Budget target: $275");
    expect(body.context.familyMembers).toHaveLength(1);
  });

  it("allows family API-key callers", async () => {
    routeState.auth = auth("ADMIN", "apiKey");

    const response = await GET(new Request("http://local.test/api/planning-brief"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.family).toEqual({
      id: "family_1",
      name: "Test Family",
    });
  });
});
