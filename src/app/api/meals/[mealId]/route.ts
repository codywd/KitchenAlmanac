import { authenticateRequest } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
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
    const payload = mealPatchSchema.parse(await request.json());
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
