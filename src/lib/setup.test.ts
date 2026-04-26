import { describe, expect, it } from "vitest";

import { buildSetupStatus, type SetupStatusInput } from "./setup";

const baseInput: SetupStatusInput = {
  activeApiKeyCount: 0,
  activePantryStapleCount: 0,
  activeRejectedMealCount: 0,
  dinnerCount: 0,
  householdDocumentCount: 0,
  householdDocumentWithContentCount: 0,
  latestWeekId: null,
  memberCount: 1,
  savedRecipeCount: 0,
  weekCount: 0,
};

describe("setup status", () => {
  it("requires family owner, guidance, API access, and a first imported plan", () => {
    const status = buildSetupStatus(baseInput, { canManage: true });

    expect(status.requiredCount).toBe(4);
    expect(status.completedRequiredCount).toBe(1);
    expect(status.isLaunchReady).toBe(false);
    expect(status.steps.filter((step) => step.required).map((step) => step.key)).toEqual([
      "family",
      "guidance",
      "api-key",
      "first-plan",
    ]);
  });

  it("marks launch readiness when required setup signals are present", () => {
    const status = buildSetupStatus(
      {
        ...baseInput,
        activeApiKeyCount: 1,
        dinnerCount: 7,
        householdDocumentCount: 3,
        householdDocumentWithContentCount: 3,
        weekCount: 1,
      },
      { canManage: true },
    );

    expect(status.completedRequiredCount).toBe(4);
    expect(status.isLaunchReady).toBe(true);
  });

  it("keeps optional household polish separate from launch readiness", () => {
    const status = buildSetupStatus(
      {
        ...baseInput,
        activeApiKeyCount: 1,
        dinnerCount: 7,
        householdDocumentCount: 3,
        householdDocumentWithContentCount: 3,
        weekCount: 1,
      },
      { canManage: true },
    );
    const optionalSteps = status.steps.filter((step) => !step.required);

    expect(status.isLaunchReady).toBe(true);
    expect(optionalSteps.map((step) => [step.key, step.complete])).toEqual([
      ["members", false],
      ["pantry", false],
      ["cookbook", false],
    ]);
  });

  it("omits management actions for read-only viewers", () => {
    const status = buildSetupStatus(baseInput, { canManage: false });

    expect(status.steps.find((step) => step.key === "family")?.href).toBeUndefined();
    expect(status.steps.find((step) => step.key === "api-key")?.actionLabel).toBeUndefined();
  });
});
