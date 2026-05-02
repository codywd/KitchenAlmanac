import type { SafeUserLlmSettings } from "./llm-settings";

export function visibleLlmSettings({
  actionSettings,
  deleteCompletedAt,
  deletePending = false,
  savedSettings,
  saveCompletedAt,
}: {
  actionSettings?: SafeUserLlmSettings | null;
  deleteCompletedAt?: string;
  deletePending?: boolean;
  savedSettings: SafeUserLlmSettings | null;
  saveCompletedAt?: string;
}) {
  if (
    deletePending ||
    (deleteCompletedAt &&
      (!saveCompletedAt ||
        Date.parse(deleteCompletedAt) >= Date.parse(saveCompletedAt)))
  ) {
    return null;
  }

  return actionSettings ?? savedSettings;
}
