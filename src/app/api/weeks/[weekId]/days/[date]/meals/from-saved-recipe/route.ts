import { revalidatePath } from "next/cache";

import { authenticateRequest } from "@/lib/api-auth";
import {
  readJsonWithLimit,
  secureMutationRequest,
} from "@/lib/api-route-security";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { rateLimitPolicies } from "@/lib/rate-limit";
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
    const securityResponse = await secureMutationRequest({
      auth,
      rateLimit: {
        policy: rateLimitPolicies.planningWrite,
        scope: "meal-write-api",
        subject: `${auth.family.id}:${auth.actorUserId ?? auth.authType}`,
      },
      request,
    });

    if (securityResponse) {
      return securityResponse;
    }

    const payload = savedRecipeSwapSchema.parse(await readJsonWithLimit(request));
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
