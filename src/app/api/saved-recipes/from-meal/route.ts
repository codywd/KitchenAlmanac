import { revalidatePath } from "next/cache";

import {
  authenticateRequest,
  getAuthenticatedActorUserId,
} from "@/lib/api-auth";
import {
  readJsonWithLimit,
  secureMutationRequest,
} from "@/lib/api-route-security";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { rateLimitPolicies } from "@/lib/rate-limit";
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
    const securityResponse = await secureMutationRequest({
      auth,
      rateLimit: {
        policy: rateLimitPolicies.planningWrite,
        scope: "saved-recipe-write-api",
        subject: `${auth.family.id}:${userId}`,
      },
      request,
    });

    if (securityResponse) {
      return securityResponse;
    }

    const payload = savedRecipeFromMealSchema.parse(await readJsonWithLimit(request));
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
