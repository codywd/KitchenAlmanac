import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const routeState = vi.hoisted(() => ({
  auth: {
    family: {
      id: "family_1",
      name: "Test Family",
    },
    role: "ADMIN" as "ADMIN" | "MEMBER" | "OWNER",
  } as null | {
    family: { id: string; name: string };
    role: "ADMIN" | "MEMBER" | "OWNER";
  },
  db: null as ReturnType<typeof makeDb>["db"] | null,
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => routeState.auth),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => routeState.db),
}));

function makeDb({
  week = {
    id: "week_1",
    weekStart: new Date("2026-05-04T00:00:00.000Z"),
  } as { id: string; weekStart: Date } | null,
}: {
  week?: { id: string; weekStart: Date } | null;
} = {}) {
  const db = {
    dayPlan: {
      upsert: vi.fn(async () => ({ id: "day_1" })),
    },
    meal: {
      upsert: vi.fn(async () => ({ id: "meal_1", name: "Rice Bowls" })),
    },
    week: {
      findFirst: vi.fn(async () => week),
    },
  };

  return { db };
}

function request() {
  return new Request("http://local.test/api/weeks/week_1/days/2026-05-06/meals", {
    body: JSON.stringify({
      ingredients: [{ item: "rice" }],
      methodSteps: ["Cook dinner."],
      name: "Rice Bowls",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
}

function params(date: string) {
  return {
    params: Promise.resolve({ date, weekId: "week_1" }),
  };
}

describe("POST /api/weeks/[weekId]/days/[date]/meals", () => {
  beforeEach(() => {
    routeState.auth = {
      family: {
        id: "family_1",
        name: "Test Family",
      },
      role: "ADMIN",
    };
    routeState.db = makeDb().db;
  });

  it("rejects meal writes outside the selected week before upserting", async () => {
    const response = await POST(request(), params("2026-05-11"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Meal date must be inside the selected week.");
    expect(routeState.db?.dayPlan.upsert).not.toHaveBeenCalled();
    expect(routeState.db?.meal.upsert).not.toHaveBeenCalled();
  });

  it("allows meal writes inside the selected week", async () => {
    const response = await POST(request(), params("2026-05-06"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(routeState.db?.dayPlan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          date: new Date("2026-05-06T00:00:00.000Z"),
          weekId: "week_1",
        },
      }),
    );
    expect(body.meal).toMatchObject({
      id: "meal_1",
      name: "Rice Bowls",
    });
  });
});
