import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const maintenanceState = vi.hoisted(() => ({
  result: {
    expiredRateLimitBuckets: 2,
    expiredSessions: 1,
    oldAuditEvents: 3,
  },
}));

vi.mock("@/lib/ops", () => ({
  runOpsMaintenance: vi.fn(async () => maintenanceState.result),
}));

import { runOpsMaintenance } from "@/lib/ops";

import { GET } from "./route";

describe("GET /api/ops/maintenance", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("rejects missing or incorrect cron auth", async () => {
    const missing = await GET(new Request("https://meals.example/api/ops/maintenance"));
    const wrong = await GET(
      new Request("https://meals.example/api/ops/maintenance", {
        headers: {
          authorization: "Bearer wrong",
        },
      }),
    );

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(runOpsMaintenance).not.toHaveBeenCalled();
  });

  it("runs maintenance with the correct cron bearer token", async () => {
    const response = await GET(
      new Request("https://meals.example/api/ops/maintenance", {
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: maintenanceState.result,
    });
    expect(runOpsMaintenance).toHaveBeenCalledTimes(1);
  });
});
