import { revalidatePath } from "next/cache";

import {
  authenticateRequest,
  getAuthenticatedActorUserId,
} from "@/lib/api-auth";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { saveMealOutcomeForFamily } from "@/lib/meal-outcomes-api";
import { mealOutcomeSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ mealId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can update meal outcomes.");
  }

  const userId = getAuthenticatedActorUserId(auth);

  if (!userId) {
    return forbidden("This action requires an API key created by a user or a signed-in user session.");
  }

  try {
    const { mealId } = await context.params;
    const payload = mealOutcomeSchema.parse(await request.json());
    const result = await saveMealOutcomeForFamily({
      familyId: auth.family.id,
      mealId,
      payload,
      userId,
    });

    if (!result) {
      return notFound("Meal not found.");
    }

    revalidatePath("/calendar");
    revalidatePath("/meal-memory");
    revalidatePath("/planner");
    revalidatePath("/rejected-meals");
    revalidatePath(`/cook/${result.meal.id}`);
    revalidatePath(`/weeks/${result.weekId}`);
    revalidatePath(`/weeks/${result.weekId}/closeout`);
    revalidatePath(`/weeks/${result.weekId}/review`);

    return json(result);
  } catch (error) {
    return badRequest(error);
  }
}
