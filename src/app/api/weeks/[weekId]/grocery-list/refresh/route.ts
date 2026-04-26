import { revalidatePath } from "next/cache";

import { authenticateRequest } from "@/lib/api-auth";
import { secureMutationRequest } from "@/lib/api-route-security";
import { canManagePlans } from "@/lib/family";
import { refreshGroceryListForFamilyWeek } from "@/lib/grocery-api";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { rateLimitPolicies } from "@/lib/rate-limit";

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
    const securityResponse = await secureMutationRequest({
      auth,
      rateLimit: {
        policy: rateLimitPolicies.planningWrite,
        scope: "grocery-list-refresh-api",
        subject: `${auth.family.id}:${auth.actorUserId ?? auth.authType}`,
      },
      request,
    });

    if (securityResponse) {
      return securityResponse;
    }

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
