import { revalidatePath } from "next/cache";

import {
  authenticateRequest,
  getAuthenticatedActorUserId,
} from "@/lib/api-auth";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { saveMealToRecipeLibraryForFamily } from "@/lib/saved-recipe-api";
import { savedRecipeFromMealSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can manage saved recipes.");
  }

  const userId = getAuthenticatedActorUserId(auth);

  if (!userId) {
    return forbidden("This action requires an API key created by a user or a signed-in user session.");
  }

  try {
    const payload = savedRecipeFromMealSchema.parse(await request.json());
    const result = await saveMealToRecipeLibraryForFamily({
      familyId: auth.family.id,
      mealId: payload.mealId,
      userId,
    });

    if (!result) {
      return notFound("Meal not found.");
    }

    revalidatePath("/meal-memory");
    revalidatePath("/planner");
    revalidatePath("/recipes");
    revalidatePath(`/weeks/${result.weekId}`);

    return json(result);
  } catch (error) {
    return badRequest(error);
  }
}
