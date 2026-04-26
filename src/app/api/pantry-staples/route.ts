import { revalidateShoppingSurfaces } from "@/lib/shopping-revalidation";
import {
  authenticateRequest,
  getAuthenticatedActorUserId,
} from "@/lib/api-auth";
import {
  readJsonWithLimit,
  secureMutationRequest,
} from "@/lib/api-route-security";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { rateLimitPolicies } from "@/lib/rate-limit";
import {
  listPantryStaplesForFamily,
  upsertPantryStapleForFamily,
} from "@/lib/pantry-staples";
import { activeFilterSchema, pantryStapleCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  try {
    const url = new URL(request.url);
    const active = activeFilterSchema.parse(url.searchParams.get("active") ?? "true");
    const pantryStaples = await listPantryStaplesForFamily({
      active,
      familyId: auth.family.id,
    });

    return json({ pantryStaples });
  } catch (error) {
    return badRequest(error);
  }
}

export async function POST(request: Request) {
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
    const securityResponse = await secureMutationRequest({
      auth,
      rateLimit: {
        policy: rateLimitPolicies.planningWrite,
        scope: "pantry-staple-write-api",
        subject: `${auth.family.id}:${userId}`,
      },
      request,
    });

    if (securityResponse) {
      return securityResponse;
    }

    const payload = pantryStapleCreateSchema.parse(await readJsonWithLimit(request));
    const pantryStaple = await upsertPantryStapleForFamily({
      displayName: payload.displayName,
      familyId: auth.family.id,
      userId,
    });

    revalidateShoppingSurfaces();

    return json({ pantryStaple }, { status: 201 });
  } catch (error) {
    return badRequest(error);
  }
}
