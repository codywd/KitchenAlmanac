import { authenticateRequest } from "@/lib/api-auth";
import {
  readJsonWithLimit,
  secureMutationRequest,
} from "@/lib/api-route-security";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { rateLimitPolicies } from "@/lib/rate-limit";
import { rejectedMealCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const rejectedMeals = await getDb().rejectedMeal.findMany({
    orderBy: {
      rejectedAt: "desc",
    },
    where: {
      familyId: auth.family.id,
    },
  });

  return json({ rejectedMeals });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can manage rejected meals.");
  }

  try {
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

    const payload = rejectedMealCreateSchema.parse(await readJsonWithLimit(request));
    const rejectedMeal = await getDb().rejectedMeal.create({
      data: {
        ...payload,
        createdByUserId: auth.actorUserId ?? null,
        familyId: auth.family.id,
      },
    });

    return json({ rejectedMeal }, { status: 201 });
  } catch (error) {
    return badRequest(error);
  }
}
