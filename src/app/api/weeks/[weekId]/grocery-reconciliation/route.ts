import { authenticateRequest } from "@/lib/api-auth";
import { getGroceryReconciliationForFamilyWeek } from "@/lib/grocery-api";
import { json, notFound, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ weekId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const { weekId } = await context.params;
  const result = await getGroceryReconciliationForFamilyWeek({
    familyId: auth.family.id,
    weekId,
  });

  return result ? json(result) : notFound("Week not found.");
}
