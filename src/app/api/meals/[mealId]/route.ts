import { authenticateRequest } from "@/lib/api-auth";
import {
  readJsonWithLimit,
  secureMutationRequest,
} from "@/lib/api-route-security";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { rateLimitPolicies } from "@/lib/rate-limit";
import { mealPatchData } from "@/lib/meal-mapping";
import { mealPatchSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ mealId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can update meals.");
  }

  try {
    const { mealId } = await context.params;
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

    const payload = mealPatchSchema.parse(await readJsonWithLimit(request));
    const existing = await getDb().meal.findFirst({
      where: {
        id: mealId,
        dayPlan: {
          week: {
            familyId: auth.family.id,
          },
        },
      },
    });

    if (!existing) {
      return notFound("Meal not found.");
    }

    const meal = await getDb().meal.update({
      data: mealPatchData(payload),
      where: {
        id: mealId,
      },
    });

    return json({ meal });
  } catch (error) {
    return badRequest(error);
  }
}
