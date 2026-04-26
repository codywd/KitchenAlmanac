import { beforeEach, describe, expect, it, vi } from "vitest";

const auditState = vi.hoisted(() => ({
  db: null as ReturnType<typeof makeDb>["db"] | null,
}));

vi.mock("./db", () => ({
  getDb: vi.fn(() => auditState.db),
}));

import { recordAuditEvent } from "./audit";

function makeDb() {
  const db = {
    auditEvent: {
      create: vi.fn(async () => ({ id: "audit_1" })),
    },
  };

  return { db };
}

describe("audit logging", () => {
  beforeEach(() => {
    auditState.db = makeDb().db;
  });

  it("redacts secrets before persisting audit metadata", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await recordAuditEvent({
      metadata: {
        nested: {
          apiKey: "mp_secret",
        },
        password: "plain-text",
        reason: "login failed",
      },
      outcome: "failure",
      requestMeta: {
        requestId: "req_1",
      },
      type: "auth.login",
    });

    expect(auditState.db?.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          nested: {
            apiKey: "[redacted]",
          },
          password: "[redacted]",
          reason: "login failed",
        },
      }),
    });

    logSpy.mockRestore();
  });
});
