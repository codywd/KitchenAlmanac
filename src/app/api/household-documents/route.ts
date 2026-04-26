import { authenticateRequest } from "@/lib/api-auth";
import { json, unauthorized } from "@/lib/http";
import { listHouseholdDocumentsForFamily } from "@/lib/household-documents";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const documents = await listHouseholdDocumentsForFamily(auth.family.id);

  return json({ documents });
}
