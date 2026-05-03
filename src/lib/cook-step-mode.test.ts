import { describe, expect, it } from "vitest";

import {
  buildCookStepMode,
  cookStepHref,
  cookStepProgressKey,
} from "./cook-step-mode";

describe("cook step mode", () => {
  const steps = [
    {
      id: "prep",
      number: 1,
      text: "Prep ingredients.",
    },
    {
      id: "cook",
      number: 2,
      text: "Cook until done.",
      timeMinutes: 12,
    },
  ];

  it("parses routed step state and clamps out-of-range values", () => {
    expect(
      buildCookStepMode({
        mealId: "meal_1",
        stepParam: "2",
        steps,
      }),
    ).toMatchObject({
      currentIndex: 1,
      currentStep: steps[1],
      isFinalStep: true,
      stepNumber: 2,
      totalSteps: 2,
    });

    expect(
      buildCookStepMode({
        mealId: "meal_1",
        stepParam: "99",
        steps,
      }).stepNumber,
    ).toBe(2);
  });

  it("provides an empty-method fallback", () => {
    const mode = buildCookStepMode({
      mealId: "meal_1",
      stepParam: "1",
      steps: [],
    });

    expect(mode.currentStep.text).toBe("No method steps are saved for this meal yet.");
    expect(mode.totalSteps).toBe(1);
    expect(mode.isFinalStep).toBe(true);
  });

  it("builds stable cook step URLs and local storage keys", () => {
    expect(cookStepHref("meal_1", 3)).toBe("/cook/meal_1?mode=steps&step=3");
    expect(cookStepProgressKey("meal_1")).toBe("kitchenalmanac:cook:meal_1");
  });
});
