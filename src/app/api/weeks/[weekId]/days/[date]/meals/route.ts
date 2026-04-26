import { authenticateRequest } from "@/lib/api-auth";
import { addDays, parseDateOnly, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { mealCreateData } from "@/lib/meal-mapping";
import { mealUpsertSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ date: string; weekId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can manage meals.");
  }

  try {
    const { date, weekId } = await context.params;
    const mealDate = parseDateOnly(date);
    const payload = mealUpsertSchema.parse(await request.json());
    const week = await getDb().week.findFirst({
      select: {
        id: true,
        weekStart: true,
      },
      where: {
        familyId: auth.family.id,
        id: weekId,
      },
    });

    if (!week) {
      return notFound("Week not found.");
    }

    const dateText = toDateOnly(mealDate);
    const weekStartText = toDateOnly(week.weekStart);
    const weekEndText = toDateOnly(addDays(week.weekStart, 6));

    if (dateText < weekStartText || dateText > weekEndText) {
      throw new Error("Meal date must be inside the selected week.");
    }

    const day = await getDb().dayPlan.upsert({
      create: {
        date: mealDate,
        weekId,
      },
      update: {},
      where: {
        weekId_date: {
          date: mealDate,
          weekId,
        },
      },
    });

    const meal = await getDb().meal.upsert({
      create: {
        ...mealCreateData(payload),
        dayPlanId: day.id,
      },
      update: mealCreateData(payload),
      where: {
        dayPlanId: day.id,
      },
    });

    return json({ meal }, { status: 201 });
  } catch (error) {
    return badRequest(error);
  }
}
