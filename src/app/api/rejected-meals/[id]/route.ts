import { authenticateRequest } from "@/lib/api-auth";
import {
  readJsonWithLimit,
  secureMutationRequest,
} from "@/lib/api-route-security";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { rateLimitPolicies } from "@/lib/rate-limit";
import { rejectedMealPatchSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can manage rejected meals.");
  }

  try {
    const { id } = await context.params;
    const securityResponse = await secureMutationRequest({
      auth,
      rateLimit: {
        policy: rateLimitPolicies.planningWrite,
        scope: "rejected-meal-write-api",
        subject: `${auth.family.id}:${auth.actorUserId ?? auth.authType}`,
      },
      request,
    });

    if (securityResponse) {
      return securityResponse;
    }

    const payload = rejectedMealPatchSchema.parse(await readJsonWithLimit(request));
    const existing = await getDb().rejectedMeal.findFirst({
      where: {
        familyId: auth.family.id,
        id,
      },
    });

    if (!existing) {
      return notFound("Rejected meal not found.");
    }

    const rejectedMeal = await getDb().rejectedMeal.update({
      data: payload,
      where: {
        id,
      },
    });

    return json({ rejectedMeal });
  } catch (error) {
    return badRequest(error);
  }
}
