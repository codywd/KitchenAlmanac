import { authenticateRequest } from "@/lib/api-auth";
import { buildRejectedMealFromFeedback } from "@/lib/feedback";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { feedbackSchema } from "@/lib/schemas";

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
    return forbidden("Only family owners and admins can update meal feedback.");
  }

  try {
    const { mealId } = await context.params;
    const payload = feedbackSchema.parse(await request.json());
    const meal = await getDb().meal.findFirst({
      where: {
        id: mealId,
        dayPlan: {
          week: {
            familyId: auth.family.id,
          },
        },
      },
    });

    if (!meal) {
      return notFound("Meal not found.");
    }

    const updatedMeal = await getDb().meal.update({
      data: {
        feedbackReason: payload.reason,
        feedbackStatus: payload.status,
        feedbackTweaks: payload.tweaks,
      },
      where: {
        id: meal.id,
      },
    });

    const rejectedMeal =
      payload.status === "REJECTED" && payload.createRejectedPattern
        ? await getDb().rejectedMeal.create({
            data: {
              ...buildRejectedMealFromFeedback({
                mealName: meal.name,
                patternToAvoid: payload.patternToAvoid,
                reason: payload.reason ?? "Rejected from meal feedback.",
              }),
              createdByUserId: auth.actorUserId ?? null,
              familyId: auth.family.id,
              sourceMealId: meal.id,
            },
          })
        : null;

    return json({ meal: updatedMeal, rejectedMeal });
  } catch (error) {
    return badRequest(error);
  }
}
