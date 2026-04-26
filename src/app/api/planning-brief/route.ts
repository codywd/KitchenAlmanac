import { authenticateRequest } from "@/lib/api-auth";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import {
  buildPlanningBriefResponse,
  getLatestFamilyBudgetTargetCents,
  loadPlanningBriefContext,
  parsePlanningBriefQuery,
} from "@/lib/planning-brief";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can generate planning briefs.");
  }

  try {
    const url = new URL(request.url);
    const defaultBudgetTargetCents = await getLatestFamilyBudgetTargetCents(
      auth.family.id,
    );
    const query = parsePlanningBriefQuery(url.searchParams, {
      defaultBudgetTargetCents,
    });
    const context = await loadPlanningBriefContext({
      familyId: auth.family.id,
      weekStart: query.weekStart,
    });

    return json(
      buildPlanningBriefResponse({
        budgetTargetCents: query.budgetTargetCents,
        context,
        family: auth.family,
        generatedAt: new Date().toISOString(),
        weekStart: query.weekStart,
      }),
    );
  } catch (error) {
    return badRequest(error);
  }
}
