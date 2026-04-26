"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { mealVoteSchema } from "@/lib/schemas";
import { requireFamilyContext } from "@/lib/family";

export async function voteMealAction(formData: FormData) {
  const context = await requireFamilyContext();
  const payload = mealVoteSchema.parse({
    comment: formData.get("comment"),
    mealId: formData.get("mealId"),
    vote: formData.get("vote"),
  });

  const meal = await getDb().meal.findFirstOrThrow({
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
          familyId: context.family.id,
        },
      },
      id: payload.mealId,
    },
  });

  await getDb().mealVote.upsert({
    create: {
      comment: payload.comment || null,
      mealId: meal.id,
      userId: context.user.id,
      vote: payload.vote,
    },
    update: {
      comment: payload.comment || null,
      vote: payload.vote,
    },
    where: {
      mealId_userId: {
        mealId: meal.id,
        userId: context.user.id,
      },
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/meal-memory");
  revalidatePath(`/cook/${meal.id}`);
  revalidatePath(`/weeks/${meal.dayPlan.week.id}`);
  revalidatePath(`/weeks/${meal.dayPlan.week.id}/closeout`);
  revalidatePath(`/weeks/${meal.dayPlan.week.id}/review`);
}
