export type MealFeedbackStatus =
  | "PLANNED"
  | "LIKED"
  | "WORKED_WITH_TWEAKS"
  | "REJECTED";

type FeedbackInput = {
  mealName: string;
  patternToAvoid?: string | null;
  reason: string;
};

export function normalizeFeedbackStatus(status: string): MealFeedbackStatus {
  const normalized = status.trim().toUpperCase().replaceAll("-", "_");

  if (
    normalized === "LIKED" ||
    normalized === "WORKED_WITH_TWEAKS" ||
    normalized === "REJECTED" ||
    normalized === "PLANNED"
  ) {
    return normalized;
  }

  throw new Error(`Unsupported meal feedback status: ${status}`);
}

export function buildRejectedMealFromFeedback(input: FeedbackInput) {
  const mealName = input.mealName.trim();
  const reason = input.reason.trim();
  const patternToAvoid = input.patternToAvoid?.trim() || reason;

  if (!mealName || !reason || !patternToAvoid) {
    throw new Error("Rejected meals require a meal name, reason, and pattern.");
  }

  return {
    mealName,
    patternToAvoid,
    reason,
  };
}
