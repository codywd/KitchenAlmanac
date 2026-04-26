import { revalidateShoppingSurfaces } from "@/lib/shopping-revalidation";
import {
  authenticateRequest,
  getAuthenticatedActorUserId,
} from "@/lib/api-auth";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { setPantryStapleActiveForFamily } from "@/lib/pantry-staples";
import { pantryStaplePatchSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ stapleId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can manage pantry staples.");
  }

  const userId = getAuthenticatedActorUserId(auth);

  if (!userId) {
    return forbidden("This action requires an API key created by a user or a signed-in user session.");
  }

  try {
    const { stapleId } = await context.params;
    const payload = pantryStaplePatchSchema.parse(await request.json());
    const pantryStaple = await setPantryStapleActiveForFamily({
      active: payload.active,
      familyId: auth.family.id,
      stapleId,
      userId,
    });

    if (!pantryStaple) {
      return notFound("Pantry staple not found.");
    }

    revalidateShoppingSurfaces();

    return json({ pantryStaple });
  } catch (error) {
    return badRequest(error);
  }
}
