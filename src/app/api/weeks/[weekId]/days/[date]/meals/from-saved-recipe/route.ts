import { revalidatePath } from "next/cache";

import { authenticateRequest } from "@/lib/api-auth";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { replaceDinnerFromSavedRecipeForFamily } from "@/lib/saved-recipe-api";
import { savedRecipeSwapSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ date: string; weekId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can manage meals.");
  }

  try {
    const { date, weekId } = await context.params;
    const payload = savedRecipeSwapSchema.parse(await request.json());
    const result = await replaceDinnerFromSavedRecipeForFamily({
      dateText: date,
      familyId: auth.family.id,
      recipeId: payload.recipeId,
      weekId,
    });

    revalidatePath("/calendar");
    revalidatePath("/ingredients");
    revalidatePath("/meal-memory");
    revalidatePath(`/weeks/${result.weekId}`);
    revalidatePath(`/weeks/${result.weekId}/closeout`);
    revalidatePath(`/weeks/${result.weekId}/review`);

    return json(result);
  } catch (error) {
    return badRequest(error);
  }
}
