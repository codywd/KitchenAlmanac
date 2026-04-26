import { authenticateRequest } from "@/lib/api-auth";
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

  if (auth.authType !== "session" || !auth.user) {
    return forbidden("Shopping updates require a signed-in family member.");
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
      userId: auth.user.id,
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
