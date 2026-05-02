import { describe, expect, it } from "vitest";

import { visibleLlmSettings } from "./llm-settings-form-state";
import type { SafeUserLlmSettings } from "./llm-settings";

const savedSettings: SafeUserLlmSettings = {
  baseUrl: "https://api.openai.com/v1",
  displayName: "Saved",
  hasApiKey: true,
  keyFingerprint: "saved-key",
  lastUsedAt: null,
  lastVerifiedAt: null,
  modelId: "gpt-old",
  providerKind: "OPENAI_COMPATIBLE",
  updatedAt: "2026-05-02T00:00:00.000Z",
};

const actionSettings: SafeUserLlmSettings = {
  ...savedSettings,
  keyFingerprint: "new-key",
  modelId: "gpt-new",
};

describe("visibleLlmSettings", () => {
  it("prefers freshly saved settings over server props", () => {
    expect(
      visibleLlmSettings({
        actionSettings,
        savedSettings,
        saveCompletedAt: "2026-05-02T00:01:00.000Z",
      }),
    ).toBe(actionSettings);
  });

  it("hides stale action settings after delete", () => {
    expect(
      visibleLlmSettings({
        actionSettings,
        deleteCompletedAt: "2026-05-02T00:02:00.000Z",
        savedSettings,
        saveCompletedAt: "2026-05-02T00:01:00.000Z",
      }),
    ).toBeNull();
  });

  it("shows settings saved after an earlier delete", () => {
    expect(
      visibleLlmSettings({
        actionSettings,
        deleteCompletedAt: "2026-05-02T00:01:00.000Z",
        savedSettings,
        saveCompletedAt: "2026-05-02T00:02:00.000Z",
      }),
    ).toBe(actionSettings);
  });
});
