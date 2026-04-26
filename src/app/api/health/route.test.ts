import { beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  health: {
    app: "ok" as const,
    checkedAt: "2026-04-26T12:00:00.000Z",
    database: "ok" as "error" | "ok",
  },
}));

vi.mock("@/lib/ops", () => ({
  getHealthStatus: vi.fn(async () => routeState.health),
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    routeState.health = {
      app: "ok",
      checkedAt: "2026-04-26T12:00:00.000Z",
      database: "ok",
    };
  });

  it("returns 200 when the database is reachable", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      app: "ok",
      database: "ok",
    });
  });

  it("returns 503 when the database check fails", async () => {
    routeState.health.database = "error";

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      app: "ok",
      database: "error",
    });
  });
});
