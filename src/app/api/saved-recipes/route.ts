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
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { rateLimitPolicies } from "@/lib/rate-limit";
import {
  createSavedRecipeForFamily,
  listSavedRecipesForFamily,
} from "@/lib/saved-recipe-api";
import { activeFilterSchema, savedRecipeCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  try {
    const url = new URL(request.url);
    const active = activeFilterSchema.parse(url.searchParams.get("active") ?? "true");
    const savedRecipes = await listSavedRecipesForFamily({
      active,
      familyId: auth.family.id,
    });

    return json({ savedRecipes });
  } catch (error) {
    return badRequest(error);
  }
}

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

    const payload = savedRecipeCreateSchema.parse(await readJsonWithLimit(request));
    const savedRecipe = await createSavedRecipeForFamily({
      familyId: auth.family.id,
      payload,
      userId,
    });

    revalidatePath("/meal-memory");
    revalidatePath("/planner");
    revalidatePath("/recipes");

    return json({ savedRecipe }, { status: 201 });
  } catch (error) {
    return badRequest(error);
  }
}
