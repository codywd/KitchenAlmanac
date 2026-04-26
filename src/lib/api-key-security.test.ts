import { describe, expect, it } from "vitest";

import {
  createApiKeyExpiryDate,
  describeApiKeyExpiry,
  needsApiKeyRotation,
} from "./api-key-security";

describe("API key security helpers", () => {
  it("defaults new keys to a finite expiry choice", () => {
    expect(
      createApiKeyExpiryDate(90, new Date("2026-04-26T12:00:00.000Z")).toISOString(),
    ).toBe("2026-07-25T12:00:00.000Z");
  });

  it("marks legacy non-expiring keys as rotation-needed", () => {
    expect(
      describeApiKeyExpiry(null, new Date("2026-04-26T12:00:00.000Z")),
    ).toBe("Legacy key: no expiry, rotate soon");
    expect(needsApiKeyRotation({ expiresAt: null })).toBe(true);
  });

  it("does not flag revoked legacy keys as active rotation work", () => {
    expect(
      needsApiKeyRotation({
        expiresAt: null,
        revokedAt: new Date("2026-04-26T12:00:00.000Z"),
      }),
    ).toBe(false);
  });
});
