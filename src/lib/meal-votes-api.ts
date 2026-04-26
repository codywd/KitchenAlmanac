import { getDb } from "./db";
import type { mealVoteSchema } from "./schemas";
import type { z } from "zod";

type MealVotePayload = z.infer<typeof mealVoteSchema>;

export async function upsertMealVoteForFamily({
  familyId,
  payload,
  userId,
}: {
  familyId: string;
  payload: MealVotePayload;
  userId: string;
}) {
  const meal = await getDb().meal.findFirst({
    include: {
      dayPlan: {
        include: {
          week: true,
        },
      },
    },
    where: {
      dayPlan: {
        week: {
          familyId,
        },
      },
      id: payload.mealId,
    },
  });

  if (!meal) {
    return null;
  }

  const vote = await getDb().mealVote.upsert({
    create: {
      comment: payload.comment || null,
      mealId: meal.id,
      userId,
      vote: payload.vote,
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    update: {
      comment: payload.comment || null,
      vote: payload.vote,
    },
    where: {
      mealId_userId: {
        mealId: meal.id,
        userId,
      },
    },
  });

  return {
    ...vote,
    weekId: meal.dayPlan.week.id,
  };
}
