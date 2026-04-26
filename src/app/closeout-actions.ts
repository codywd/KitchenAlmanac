"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { assertCanManagePlans, requireFamilyContext } from "@/lib/family";
import { buildRejectedMealFromFeedback } from "@/lib/feedback";
import { normalizeFeedbackStatus } from "@/lib/feedback";
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
  const meal = await getDb().meal.findFirst({
    where: {
      dayPlan: {
        week: {
          familyId: context.family.id,
          id: weekId,
        },
      },
      id: mealId,
    },
  });

  if (!meal) {
    return {
      error: "Meal not found.",
    };
  }

  const feedbackReason = trimmed(formData, "feedbackReason");
  const feedbackTweaks = trimmed(formData, "feedbackTweaks");
  const leftoverNotes = trimmed(formData, "leftoverNotes");
  const outcomeNotes = trimmed(formData, "outcomeNotes");
  const patternToAvoid = trimmed(formData, "patternToAvoid");
  const createRejectedPattern = formData.get("createRejectedPattern") === "on";
  const closedOut = outcomeStatus !== "PLANNED";

  await getDb().meal.update({
    data: {
      actualCostCents,
      closedOutAt: closedOut ? new Date() : null,
      closedOutByUserId: closedOut ? context.user.id : null,
      feedbackReason: feedbackReason || null,
      feedbackStatus,
      feedbackTweaks: feedbackTweaks || null,
      leftoverNotes: leftoverNotes || null,
      outcomeNotes: outcomeNotes || null,
      outcomeStatus,
    },
    where: {
      id: meal.id,
    },
  });

  if (feedbackStatus === "REJECTED" && createRejectedPattern) {
    await getDb().rejectedMeal.create({
      data: {
        ...buildRejectedMealFromFeedback({
          mealName: meal.name,
          patternToAvoid,
          reason: feedbackReason || "Rejected from meal closeout.",
        }),
        createdByUserId: context.user.id,
        familyId: context.family.id,
        sourceMealId: meal.id,
      },
    });
  }

  revalidatePath("/calendar");
  revalidatePath("/meal-memory");
  revalidatePath("/planner");
  revalidatePath("/rejected-meals");
  revalidatePath(`/cook/${meal.id}`);
  revalidatePath(`/weeks/${weekId}`);
  revalidatePath(`/weeks/${weekId}/closeout`);
  revalidatePath(`/weeks/${weekId}/review`);

  return {
    mealId: meal.id,
    message: `Saved closeout for ${meal.name}.`,
    weekId,
  };
}
