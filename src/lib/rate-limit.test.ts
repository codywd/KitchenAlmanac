import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashValue, RequestSecurityError } from "./security";

const rateLimitState = vi.hoisted(() => ({
  auditEvents: [] as unknown[],
  db: null as ReturnType<typeof makeDb>["db"] | null,
  existing: null as null | {
    blockedUntil: Date | null;
    count: number;
    windowExpiresAt: Date;
  },
}));

vi.mock("./audit", () => ({
  recordAuditEvent: vi.fn(async (event: unknown) => {
    rateLimitState.auditEvents.push(event);
  }),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(() => rateLimitState.db),
}));

import { assertRateLimit, evaluateRateLimitBucket } from "./rate-limit";

function makeDb() {
  const db = {
    rateLimitBucket: {
      findUnique: vi.fn(async () => rateLimitState.existing),
      upsert: vi.fn(async (args: unknown) => args),
    },
  };

  return { db };
}

describe("rate limiting", () => {
  beforeEach(() => {
    rateLimitState.auditEvents = [];
    rateLimitState.existing = null;
    rateLimitState.db = makeDb().db;
  });

  it("creates a fresh bucket when no active window exists", () => {
    const now = new Date("2026-04-26T12:00:00.000Z");
    const decision = evaluateRateLimitBucket({
      existing: null,
      now,
      policy: {
        limit: 2,
        windowMs: 60_000,
      },
    });

    expect(decision).toMatchObject({
      allowed: true,
      count: 1,
      windowStart: now,
    });
    expect(decision.windowExpiresAt.toISOString()).toBe(
      "2026-04-26T12:01:00.000Z",
    );
  });

  it("increments an active bucket and resets an expired bucket", () => {
    const now = new Date("2026-04-26T12:00:00.000Z");

    expect(
      evaluateRateLimitBucket({
        existing: {
          blockedUntil: null,
          count: 1,
          windowExpiresAt: new Date("2026-04-26T12:01:00.000Z"),
        },
        now,
        policy: {
          limit: 3,
          windowMs: 60_000,
        },
      }).count,
    ).toBe(2);

    expect(
      evaluateRateLimitBucket({
        existing: {
          blockedUntil: null,
          count: 3,
          windowExpiresAt: new Date("2026-04-26T11:59:59.000Z"),
        },
        now,
        policy: {
          limit: 3,
          windowMs: 60_000,
        },
      }).count,
    ).toBe(1);
  });

  it("blocks requests that exceed the policy limit", () => {
    const now = new Date("2026-04-26T12:00:00.000Z");
    const decision = evaluateRateLimitBucket({
      existing: {
        blockedUntil: null,
        count: 2,
        windowExpiresAt: new Date("2026-04-26T12:01:00.000Z"),
      },
      now,
      policy: {
        blockMs: 120_000,
        limit: 2,
        windowMs: 60_000,
      },
    });

    expect(decision).toMatchObject({
      allowed: false,
      count: 3,
      retryAfterSeconds: 120,
    });
  });

  it("stores bucket keys with hashed subjects", async () => {
    await assertRateLimit({
      policy: {
        limit: 10,
        windowMs: 60_000,
      },
      scope: "login",
      subject: "owner@example.local:127.0.0.1",
    });

    expect(rateLimitState.db?.rateLimitBucket.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: `login:${hashValue("owner@example.local:127.0.0.1")}`,
          scope: "login",
          subject: hashValue("owner@example.local:127.0.0.1"),
        }),
      }),
    );
  });

  it("audits and throws a 429 on lockout", async () => {
    rateLimitState.existing = {
      blockedUntil: null,
      count: 5,
      windowExpiresAt: new Date(Date.now() + 60_000),
    };

    await expect(
      assertRateLimit({
        familyId: "family_1",
        policy: {
          blockMs: 60_000,
          limit: 5,
          windowMs: 60_000,
        },
        requestMeta: {
          requestId: "req_1",
        },
        scope: "login",
        subject: "owner@example.local",
      }),
    ).rejects.toBeInstanceOf(RequestSecurityError);

    expect(rateLimitState.auditEvents).toEqual([
      expect.objectContaining({
        familyId: "family_1",
        outcome: "failure",
        type: "rate_limit.lockout",
      }),
    ]);
  });
});
