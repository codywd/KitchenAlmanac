import { describe, expect, it } from "vitest";

import { parseDateOnly, toDateOnly } from "./dates";

describe("date-only parsing", () => {
  it("parses valid calendar dates at UTC midnight", () => {
    const parsed = parseDateOnly("2026-02-28");

    expect(toDateOnly(parsed)).toBe("2026-02-28");
    expect(parsed.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("rejects impossible dates instead of normalizing them", () => {
    expect(() => parseDateOnly("2026-02-31")).toThrow(
      "Dates must be a valid YYYY-MM-DD date.",
    );
  });
});
