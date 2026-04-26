import { getDb } from "./db";
import { normalizeIngredientName } from "./ingredients";

export type ActiveFilter = "true" | "false" | "all";

function activeWhere(active: ActiveFilter) {
  if (active === "all") {
    return {};
  }

  return {
    active: active === "true",
  };
}

export async function listPantryStaplesForFamily({
  active,
  familyId,
}: {
  active: ActiveFilter;
  familyId: string;
}) {
  return getDb().pantryStaple.findMany({
    orderBy: {
      displayName: "asc",
    },
    where: {
      familyId,
      ...activeWhere(active),
    },
  });
}

export async function upsertPantryStapleForFamily({
  displayName,
  familyId,
  userId,
}: {
  displayName: string;
  familyId: string;
  userId: string;
}) {
  const canonicalName = normalizeIngredientName(displayName);

  return getDb().pantryStaple.upsert({
    create: {
      active: true,
      canonicalName,
      createdByUserId: userId,
      displayName,
      familyId,
    },
    update: {
      active: true,
      createdByUserId: userId,
      displayName,
    },
    where: {
      familyId_canonicalName: {
        canonicalName,
        familyId,
      },
    },
  });
}

export async function setPantryStapleActiveForFamily({
  active,
  familyId,
  stapleId,
  userId,
}: {
  active: boolean;
  familyId: string;
  stapleId: string;
  userId: string;
}) {
  const result = await getDb().pantryStaple.updateMany({
    data: active
      ? {
          active: true,
          deactivatedByUserId: null,
        }
      : {
          active: false,
          deactivatedByUserId: userId,
        },
    where: {
      familyId,
      id: stapleId,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return getDb().pantryStaple.findFirst({
    where: {
      familyId,
      id: stapleId,
    },
  });
}
