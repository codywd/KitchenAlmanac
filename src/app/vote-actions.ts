"use server";

import { revalidatePath } from "next/cache";

import { mealVoteSchema } from "@/lib/schemas";
import { requireFamilyContext } from "@/lib/family";
import { upsertMealVoteForFamily } from "@/lib/meal-votes-api";

export async function voteMealAction(formData: FormData) {
  const context = await requireFamilyContext();
  const payload = mealVoteSchema.parse({
    comment: formData.get("comment"),
    mealId: formData.get("mealId"),
    vote: formData.get("vote"),
  });

  const vote = await upsertMealVoteForFamily({
    familyId: context.family.id,
    payload,
    userId: context.user.id,
  });

  if (!vote) {
    throw new Error("Meal not found.");
  }

  revalidatePath("/calendar");
  revalidatePath("/meal-memory");
  revalidatePath(`/cook/${payload.mealId}`);
  revalidatePath(`/weeks/${vote.weekId}`);
  revalidatePath(`/weeks/${vote.weekId}/closeout`);
  revalidatePath(`/weeks/${vote.weekId}/review`);
}
