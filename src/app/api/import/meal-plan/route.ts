import { authenticateRequest } from "@/lib/api-auth";
import { parseDateOnly, startOfMealPlanWeek } from "@/lib/dates";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { importMealPlanForFamily } from "@/lib/recipe-import-service";

export const dynamic = "force-dynamic";

function splitImportBody(body: unknown, request: Request) {
  const url = new URL(request.url);
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const weekStartInput =
    record.weekStart ?? record.week_start ?? url.searchParams.get("weekStart");
  const plan = record.plan ?? body;

  return {
    plan,
    weekStart:
      typeof weekStartInput === "string"
        ? parseDateOnly(weekStartInput)
        : startOfMealPlanWeek(),
  };
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can import meal plans.");
  }

  try {
    const body = await request.json();
    const { plan, weekStart } = splitImportBody(body, request);
    const result = await importMealPlanForFamily({
      familyId: auth.family.id,
      plan,
      weekStart,
    });

    return json(result, { status: 201 });
  } catch (error) {
    return badRequest(error);
  }
}
