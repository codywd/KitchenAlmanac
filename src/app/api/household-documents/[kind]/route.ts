import { revalidatePath } from "next/cache";

import { authenticateRequest } from "@/lib/api-auth";
import { canManageGuidance } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { upsertHouseholdDocumentForFamily } from "@/lib/household-documents";
import {
  householdDocumentKindSchema,
  householdDocumentUpsertSchema,
} from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ kind: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManageGuidance(auth.role)) {
    return forbidden("Only family owners and admins can manage planning guidance.");
  }

  try {
    const { kind } = await context.params;
    const parsedKind = householdDocumentKindSchema.parse(kind);
    const payload = householdDocumentUpsertSchema.parse(await request.json());
    const document = await upsertHouseholdDocumentForFamily({
      content: payload.content,
      familyId: auth.family.id,
      kind: parsedKind,
      title: payload.title,
    });

    revalidatePath("/household");
    revalidatePath("/planner");

    return json({ document });
  } catch (error) {
    return badRequest(error);
  }
}
