import { authenticateRequest } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { groceryListSchema } from "@/lib/schemas";

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
    const payload = groceryListSchema.parse(await request.json());
    const week = await getDb().week.findFirst({
      where: {
        familyId: auth.family.id,
        id: weekId,
      },
    });

    if (!week) {
      return notFound("Week not found.");
    }

    const groceryList = await getDb().groceryList.upsert({
      create: {
        notes: payload.notes,
        sections: payload.sections,
        weekId,
      },
      update: {
        notes: payload.notes,
        sections: payload.sections,
      },
      where: {
        weekId,
      },
    });

    return json({ groceryList }, { status: 201 });
  } catch (error) {
    return badRequest(error);
  }
}
