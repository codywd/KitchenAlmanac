import {
  authenticateRequest,
  getAuthenticatedActorUserId,
} from "@/lib/api-auth";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { shoppingItemStatusUpdateSchema } from "@/lib/schemas";
import { revalidateShoppingSurfaces } from "@/lib/shopping-revalidation";
import { upsertShoppingItemStatusForFamily } from "@/lib/shopping-status";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ weekId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const userId = getAuthenticatedActorUserId(auth);

  if (!userId) {
    return forbidden("Shopping updates require an API key created by a user or a signed-in family member.");
  }

  try {
    const { weekId } = await context.params;
    const payload = shoppingItemStatusUpdateSchema.parse({
      ...(await request.json()),
      weekId,
    });
    const shoppingItemState = await upsertShoppingItemStatusForFamily({
      familyId: auth.family.id,
      payload,
      userId,
    });

    if (!shoppingItemState) {
      return notFound("Week not found.");
    }

    revalidateShoppingSurfaces(weekId);

    return json({
      message: `Updated ${payload.itemName}.`,
      shoppingItemState,
      weekId,
    });
  } catch (error) {
    return badRequest(error);
  }
}
