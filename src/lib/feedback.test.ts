import { describe, expect, it } from "vitest";

import { buildRejectedMealFromFeedback, normalizeFeedbackStatus } from "./feedback";

describe("feedback helpers", () => {
  it("normalizes the three supported meal feedback states", () => {
    expect(normalizeFeedbackStatus("liked")).toBe("LIKED");
    expect(normalizeFeedbackStatus("worked-with-tweaks")).toBe(
      "WORKED_WITH_TWEAKS",
    );
    expect(normalizeFeedbackStatus("rejected")).toBe("REJECTED");
  });

  it("turns rejected feedback into a reusable rejected-meal pattern", () => {
    const rejected = buildRejectedMealFromFeedback({
      mealName: "Lentil Soup with Kale",
      reason: "Kids refused the texture.",
      patternToAvoid: "Kale-heavy soups as a primary dinner.",
    });

    expect(rejected).toEqual({
      mealName: "Lentil Soup with Kale",
      reason: "Kids refused the texture.",
      patternToAvoid: "Kale-heavy soups as a primary dinner.",
    });
  });

  it("falls back to the rejection reason when no explicit pattern is provided", () => {
    const rejected = buildRejectedMealFromFeedback({
      mealName: "Turkey Zoodle Bake",
      reason: "Too watery for everyone.",
    });

    expect(rejected.patternToAvoid).toBe("Too watery for everyone.");
  });
});
