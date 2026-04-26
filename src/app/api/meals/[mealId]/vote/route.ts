import { revalidatePath } from "next/cache";

import {
  authenticateRequest,
  getAuthenticatedActorUserId,
} from "@/lib/api-auth";
import {
  readJsonWithLimit,
  secureMutationRequest,
} from "@/lib/api-route-security";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { upsertMealVoteForFamily } from "@/lib/meal-votes-api";
import { rateLimitPolicies } from "@/lib/rate-limit";
import { mealVoteSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ mealId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const userId = getAuthenticatedActorUserId(auth);

  if (!userId) {
    return forbidden("This action requires an API key created by a user or a signed-in user session.");
  }

  try {
    const { mealId } = await context.params;
    const securityResponse = await secureMutationRequest({
      auth,
      rateLimit: {
        policy: rateLimitPolicies.planningWrite,
        scope: "meal-vote-write-api",
        subject: `${auth.family.id}:${userId}`,
      },
      request,
    });

    if (securityResponse) {
      return securityResponse;
    }

    const payload = mealVoteSchema.parse({
      ...(await readJsonWithLimit(request)),
      mealId,
    });
    const mealVote = await upsertMealVoteForFamily({
      familyId: auth.family.id,
      payload,
      userId,
    });

    if (!mealVote) {
      return notFound("Meal not found.");
    }

    revalidatePath("/calendar");
    revalidatePath("/meal-memory");
    revalidatePath(`/cook/${mealId}`);
    revalidatePath(`/weeks/${mealVote.weekId}`);
    revalidatePath(`/weeks/${mealVote.weekId}/closeout`);
    revalidatePath(`/weeks/${mealVote.weekId}/review`);

    return json({ mealVote });
  } catch (error) {
    return badRequest(error);
  }
}
