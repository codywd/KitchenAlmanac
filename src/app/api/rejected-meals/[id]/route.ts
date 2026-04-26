import { authenticateRequest } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
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
    const payload = rejectedMealPatchSchema.parse(await request.json());
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
