"use server";

import { revalidatePath } from "next/cache";

import { assertCanManagePlans, requireFamilyContext } from "@/lib/family";
import { normalizeFeedbackStatus } from "@/lib/feedback";
import { saveMealOutcomeForFamily } from "@/lib/meal-outcomes-api";
import { normalizeMealOutcomeStatus } from "@/lib/week-closeout";

export type MealOutcomeActionState = {
  error?: string;
  mealId?: string;
  message?: string;
  weekId?: string;
};

function trimmed(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function parseActualCostCents(value: string) {
  if (!value) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error("Actual cost must be a positive dollar amount.");
  }

  const dollars = Number(value);

  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new Error("Actual cost must be a positive dollar amount.");
  }

  return Math.round(dollars * 100);
}

export async function saveMealOutcomeAction(
  _previousState: MealOutcomeActionState,
  formData: FormData,
): Promise<MealOutcomeActionState> {
  const weekId = trimmed(formData, "weekId");
  const context = await requireFamilyContext(`/weeks/${weekId}/closeout`);
  assertCanManagePlans(context.role);

  let actualCostCents: number | null;
  let feedbackStatus: ReturnType<typeof normalizeFeedbackStatus>;
  let outcomeStatus: ReturnType<typeof normalizeMealOutcomeStatus>;

  try {
    actualCostCents = parseActualCostCents(trimmed(formData, "actualCostDollars"));
    feedbackStatus = normalizeFeedbackStatus(trimmed(formData, "feedbackStatus"));
    outcomeStatus = normalizeMealOutcomeStatus(trimmed(formData, "outcomeStatus"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save closeout.",
    };
  }

  const mealId = trimmed(formData, "mealId");
  const feedbackReason = trimmed(formData, "feedbackReason");
  const feedbackTweaks = trimmed(formData, "feedbackTweaks");
  const leftoverNotes = trimmed(formData, "leftoverNotes");
  const outcomeNotes = trimmed(formData, "outcomeNotes");
  const patternToAvoid = trimmed(formData, "patternToAvoid");
  const createRejectedPattern = formData.get("createRejectedPattern") === "on";

  const result = await saveMealOutcomeForFamily({
    familyId: context.family.id,
    mealId,
    payload: {
      actualCostCents,
      createRejectedPattern,
      feedbackReason,
      feedbackStatus,
      feedbackTweaks,
      leftoverNotes,
      outcomeNotes,
      outcomeStatus,
      patternToAvoid,
    },
    userId: context.user.id,
    weekId,
  });

  if (!result) {
    return {
      error: "Meal not found.",
    };
  }

  revalidatePath("/calendar");
  revalidatePath("/meal-memory");
  revalidatePath("/planner");
  revalidatePath("/rejected-meals");
  revalidatePath(`/cook/${result.meal.id}`);
  revalidatePath(`/weeks/${weekId}`);
  revalidatePath(`/weeks/${weekId}/closeout`);
  revalidatePath(`/weeks/${weekId}/review`);

  return {
    mealId: result.meal.id,
    message: `Saved closeout for ${result.meal.name}.`,
    weekId,
  };
}
