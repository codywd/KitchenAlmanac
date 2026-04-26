import { revalidatePath } from "next/cache";

import { authenticateRequest } from "@/lib/api-auth";
import { canManagePlans } from "@/lib/family";
import { refreshGroceryListForFamilyWeek } from "@/lib/grocery-api";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ weekId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can manage grocery lists.");
  }

  try {
    const { weekId } = await context.params;
    const result = await refreshGroceryListForFamilyWeek({
      familyId: auth.family.id,
      weekId,
    });

    if (!result) {
      return notFound("Week not found.");
    }

    revalidatePath("/ingredients");
    revalidatePath(`/weeks/${weekId}`);
    revalidatePath(`/weeks/${weekId}/review`);

    return json(result);
  } catch (error) {
    return badRequest(error);
  }
}
