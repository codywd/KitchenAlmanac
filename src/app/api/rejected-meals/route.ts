import { authenticateRequest } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { rejectedMealCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const rejectedMeals = await getDb().rejectedMeal.findMany({
    orderBy: {
      rejectedAt: "desc",
    },
    where: {
      familyId: auth.family.id,
    },
  });

  return json({ rejectedMeals });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can manage rejected meals.");
  }

  try {
    const payload = rejectedMealCreateSchema.parse(await request.json());
    const rejectedMeal = await getDb().rejectedMeal.create({
      data: {
        ...payload,
        createdByUserId: auth.actorUserId ?? null,
        familyId: auth.family.id,
      },
    });

    return json({ rejectedMeal }, { status: 201 });
  } catch (error) {
    return badRequest(error);
  }
}
