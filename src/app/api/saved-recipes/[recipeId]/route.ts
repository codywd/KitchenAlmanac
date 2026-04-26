import { revalidatePath } from "next/cache";

import {
  authenticateRequest,
  getAuthenticatedActorUserId,
} from "@/lib/api-auth";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import {
  getSavedRecipeForFamily,
  updateSavedRecipeForFamily,
} from "@/lib/saved-recipe-api";
import { savedRecipePatchSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ recipeId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const { recipeId } = await context.params;
  const savedRecipe = await getSavedRecipeForFamily({
    familyId: auth.family.id,
    recipeId,
  });

  return savedRecipe ? json({ savedRecipe }) : notFound("Recipe not found.");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ recipeId: string }> },
) {
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
    const { recipeId } = await context.params;
    const payload = savedRecipePatchSchema.parse(await request.json());
    const savedRecipe = await updateSavedRecipeForFamily({
      familyId: auth.family.id,
      payload,
      recipeId,
      userId,
    });

    if (!savedRecipe) {
      return notFound("Recipe not found.");
    }

    revalidatePath("/meal-memory");
    revalidatePath("/planner");
    revalidatePath("/recipes");

    return json({ savedRecipe });
  } catch (error) {
    return badRequest(error);
  }
}
