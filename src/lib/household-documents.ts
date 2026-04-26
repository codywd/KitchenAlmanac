import type { HouseholdDocumentKind } from "@prisma/client";

import { getDb } from "./db";

export async function listHouseholdDocumentsForFamily(familyId: string) {
  return getDb().householdDocument.findMany({
    orderBy: {
      kind: "asc",
    },
    where: {
      familyId,
    },
  });
}

export async function upsertHouseholdDocumentForFamily({
  content,
  familyId,
  kind,
  title,
}: {
  content: string;
  familyId: string;
  kind: HouseholdDocumentKind;
  title?: string;
}) {
  return getDb().householdDocument.upsert({
    create: {
      content,
      familyId,
      kind,
      title: title ?? kind.replaceAll("_", " ").toLowerCase(),
    },
    update: {
      content,
      ...(title ? { title } : {}),
    },
    where: {
      familyId_kind: {
        familyId,
        kind,
      },
    },
  });
}
