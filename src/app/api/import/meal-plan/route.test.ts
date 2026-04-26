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

function recipe(day: string, title: string) {
  return {
    day,
    dinner_title: title,
    ingredients: [{ name: "rice" }],
    instructions: [{ text: "Cook dinner." }],
  };
}

function makeDb() {
  return {
    db: {
      $transaction: vi.fn(),
    },
  };
}

function request(body: unknown) {
  return new Request("http://local.test/api/import/meal-plan", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
}

describe("POST /api/import/meal-plan", () => {
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

  it("returns 400 and does not write when the import has structural blockers", async () => {
    const response = await POST(
      request({
        plan: {
          recipes: [
            recipe("Monday", "First Monday"),
            recipe("Monday", "Second Monday"),
          ],
        },
        weekStart: "2026-05-04",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Duplicate Dinner Date");
    expect(routeState.db?.$transaction).not.toHaveBeenCalled();
  });
});
