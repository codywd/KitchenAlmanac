import { authenticateRequest } from "@/lib/api-auth";
import {
  readTextWithLimit,
  secureMutationRequest,
} from "@/lib/api-route-security";
import { recordAuditEvent } from "@/lib/audit";
import { parseDateOnly, startOfMealPlanWeek } from "@/lib/dates";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { parseJsonWithRepair } from "@/lib/json-repair";
import { rateLimitPolicies } from "@/lib/rate-limit";
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

  const securityResponse = await secureMutationRequest({
    auth,
    rateLimit: {
      policy: rateLimitPolicies.importPlan,
      scope: "import-plan-api",
      subject: `${auth.family.id}:${auth.actorUserId ?? auth.authType}`,
    },
    request,
  });

  if (securityResponse) {
    return securityResponse;
  }

  try {
    const body = parseJsonWithRepair(await readTextWithLimit(request)).value;
    const { plan, weekStart } = splitImportBody(body, request);
    const result = await importMealPlanForFamily({
      familyId: auth.family.id,
      plan,
      weekStart,
    });

    await recordAuditEvent({
      actorUserId: auth.actorUserId ?? auth.user?.id,
      familyId: auth.family.id,
      outcome: "success",
      request,
      subjectId: result.week.id,
      subjectType: "week",
      type: "meal_plan.import",
    });

    return json(result, { status: 201 });
  } catch (error) {
    await recordAuditEvent({
      actorUserId: auth.actorUserId ?? auth.user?.id,
      familyId: auth.family.id,
      outcome: "failure",
      request,
      type: "meal_plan.import",
    });
    return badRequest(error);
  }
}
