import { getDb } from "./db";
import { buildRejectedMealFromFeedback } from "./feedback";
import type { mealOutcomeSchema } from "./schemas";
import type { z } from "zod";

type MealOutcomePayload = z.infer<typeof mealOutcomeSchema>;

export async function saveMealOutcomeForFamily({
  familyId,
  mealId,
  payload,
  userId,
  weekId,
}: {
  familyId: string;
  mealId: string;
  payload: MealOutcomePayload;
  userId: string;
  weekId?: string;
}) {
  const meal = await getDb().meal.findFirst({
    include: {
      dayPlan: {
        select: {
          weekId: true,
        },
      },
    },
    where: {
      dayPlan: {
        week: {
          familyId,
          ...(weekId ? { id: weekId } : {}),
        },
      },
      id: mealId,
    },
  });

  if (!meal) {
    return null;
  }

  const closedOut = payload.outcomeStatus !== "PLANNED";
  const updatedMeal = await getDb().meal.update({
    data: {
      actualCostCents: payload.actualCostCents ?? null,
      closedOutAt: closedOut ? new Date() : null,
      closedOutByUserId: closedOut ? userId : null,
      feedbackReason: payload.feedbackReason?.trim() || null,
      feedbackStatus: payload.feedbackStatus,
      feedbackTweaks: payload.feedbackTweaks?.trim() || null,
      leftoverNotes: payload.leftoverNotes?.trim() || null,
      outcomeNotes: payload.outcomeNotes?.trim() || null,
      outcomeStatus: payload.outcomeStatus,
    },
    where: {
      id: meal.id,
    },
  });

  const rejectedMeal =
    payload.feedbackStatus === "REJECTED" && payload.createRejectedPattern
      ? await getDb().rejectedMeal.create({
          data: {
            ...buildRejectedMealFromFeedback({
              mealName: meal.name,
              patternToAvoid: payload.patternToAvoid,
              reason: payload.feedbackReason || "Rejected from meal closeout.",
            }),
            createdByUserId: userId,
            familyId,
            sourceMealId: meal.id,
          },
        })
      : null;

  return {
    meal: updatedMeal,
    rejectedMeal,
    weekId: meal.dayPlan.weekId,
  };
}
