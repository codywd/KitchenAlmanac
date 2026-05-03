import { Prisma } from "@prisma/client";

import {
  buildGrocerySectionsFromIngredients,
  countGroceryItems,
  reconcileGroceryList,
  readGrocerySections,
  refreshedGroceryListNotes,
} from "./grocery-reconciliation";
import { aggregateIngredientsForWeek } from "./ingredients";
import { getDb } from "./db";
import {
  buildSmartGrocerySuggestions,
  mergeSmartGrocerySelections,
  type SmartGrocerySuggestions,
} from "./smart-grocery";

export const smartMergedGroceryListNotes =
  "Smart merged from current plans and household history.";

async function loadWeekAndDerivedSections({
  familyId,
  weekId,
}: {
  familyId: string;
  weekId: string;
}) {
  const week = await getDb().week.findFirst({
    include: {
      days: {
        include: {
          dinner: true,
        },
        orderBy: {
          date: "asc",
        },
      },
      groceryList: true,
    },
    where: {
      familyId,
      id: weekId,
    },
  });

  if (!week) {
    return null;
  }

  const pantryStaples = await getDb().pantryStaple.findMany({
    select: {
      active: true,
      canonicalName: true,
      displayName: true,
    },
    where: {
      active: true,
      familyId,
    },
  });
  const ingredients = aggregateIngredientsForWeek(
    week.days
      .filter((day) => day.dinner)
      .map((day) => ({
        date: day.date,
        ingredients: day.dinner!.ingredients,
        mealName: day.dinner!.name,
      })),
  );
  const derivedSections = buildGrocerySectionsFromIngredients(
    ingredients,
    pantryStaples,
  );
  const storedSections = readGrocerySections(week.groceryList?.sections);

  return {
    derivedSections,
    pantryStaples,
    storedSections,
    week,
  };
}

export async function getGroceryReconciliationForFamilyWeek({
  familyId,
  weekId,
}: {
  familyId: string;
  weekId: string;
}) {
  const result = await loadWeekAndDerivedSections({ familyId, weekId });

  if (!result) {
    return null;
  }

  return {
    derivedSections: result.derivedSections,
    reconciliation: reconcileGroceryList({
      derivedSections: result.derivedSections,
      storedSections: result.storedSections,
    }),
    storedSections: result.storedSections,
    weekId,
  };
}

async function loadSmartGroceryMergeContext({
  familyId,
  weekId,
}: {
  familyId: string;
  weekId: string;
}) {
  const result = await loadWeekAndDerivedSections({ familyId, weekId });

  if (!result) {
    return null;
  }

  const [recentWeeks, shoppingItemStates] = await Promise.all([
    getDb().week.findMany({
      include: {
        groceryList: true,
      },
      orderBy: {
        weekStart: "desc",
      },
      take: 8,
      where: {
        familyId,
        id: {
          not: weekId,
        },
      },
    }),
    getDb().shoppingItemState.findMany({
      select: {
        canonicalName: true,
        itemName: true,
        quantity: true,
        status: true,
      },
      where: {
        familyId,
      },
    }),
  ]);
  const smartSuggestions = buildSmartGrocerySuggestions({
    derivedSections: result.derivedSections,
    pantryStaples: result.pantryStaples,
    recentGrocerySections: recentWeeks.map((week) =>
      readGrocerySections(week.groceryList?.sections),
    ),
    shoppingItemStates,
    storedSections: result.storedSections,
  });

  return {
    ...result,
    smartSuggestions,
  };
}

export async function getSmartGroceryMergeForFamilyWeek({
  familyId,
  weekId,
}: {
  familyId: string;
  weekId: string;
}) {
  const result = await loadSmartGroceryMergeContext({ familyId, weekId });

  if (!result) {
    return null;
  }

  return {
    smartSuggestions: result.smartSuggestions,
    weekId,
  };
}

function validAcceptedAdditions({
  acceptedCanonicalNames,
  smartSuggestions,
}: {
  acceptedCanonicalNames: string[];
  smartSuggestions: SmartGrocerySuggestions;
}) {
  const allowed = new Set(
    [
      ...smartSuggestions.currentPlanMissing,
      ...smartSuggestions.recurringAdditions,
    ].map((item) => item.canonicalName),
  );

  return Array.from(
    new Set(acceptedCanonicalNames.filter((name) => allowed.has(name))),
  );
}

function validPantryCandidates({
  pantryCandidateCanonicalNames,
  smartSuggestions,
}: {
  pantryCandidateCanonicalNames: string[];
  smartSuggestions: SmartGrocerySuggestions;
}) {
  const pantryCandidates = new Map(
    smartSuggestions.pantryCandidates.map((item) => [item.canonicalName, item]),
  );

  return Array.from(new Set(pantryCandidateCanonicalNames))
    .map((name) => pantryCandidates.get(name))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function suggestionCountText(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export async function applySmartGroceryMergeForFamilyWeek({
  acceptedCanonicalNames,
  familyId,
  pantryCandidateCanonicalNames,
  weekId,
}: {
  acceptedCanonicalNames: string[];
  familyId: string;
  pantryCandidateCanonicalNames: string[];
  weekId: string;
}) {
  const result = await loadSmartGroceryMergeContext({ familyId, weekId });

  if (!result) {
    return null;
  }

  const acceptedAdditions = validAcceptedAdditions({
    acceptedCanonicalNames,
    smartSuggestions: result.smartSuggestions,
  });
  const acceptedPantryCandidates = validPantryCandidates({
    pantryCandidateCanonicalNames,
    smartSuggestions: result.smartSuggestions,
  });

  if (!acceptedAdditions.length && !acceptedPantryCandidates.length) {
    throw new Error("Choose at least one smart grocery suggestion.");
  }

  let groceryList = result.week.groceryList;

  if (acceptedAdditions.length) {
    const sections = mergeSmartGrocerySelections({
      acceptedCanonicalNames: acceptedAdditions,
      smartSuggestions: result.smartSuggestions,
      storedSections: result.storedSections,
    });

    groceryList = await getDb().groceryList.upsert({
      create: {
        notes: smartMergedGroceryListNotes,
        sections: sections as unknown as Prisma.InputJsonValue,
        weekId: result.week.id,
      },
      update: {
        notes: smartMergedGroceryListNotes,
        sections: sections as unknown as Prisma.InputJsonValue,
      },
      where: {
        weekId: result.week.id,
      },
    });
  }

  await Promise.all(
    acceptedPantryCandidates.map((candidate) =>
      getDb().pantryStaple.upsert({
        create: {
          canonicalName: candidate.canonicalName,
          displayName: candidate.itemName,
          familyId,
        },
        update: {
          active: true,
          displayName: candidate.itemName,
        },
        where: {
          familyId_canonicalName: {
            canonicalName: candidate.canonicalName,
            familyId,
          },
        },
      }),
    ),
  );

  return {
    groceryAdditionCount: acceptedAdditions.length,
    groceryList,
    message: `Applied ${suggestionCountText(
      acceptedAdditions.length,
      "grocery addition suggestion",
    )} and ${suggestionCountText(
      acceptedPantryCandidates.length,
      "pantry suggestion",
    )}.`,
    pantryCandidateCount: acceptedPantryCandidates.length,
    weekId: result.week.id,
  };
}

export async function refreshGroceryListForFamilyWeek({
  familyId,
  weekId,
}: {
  familyId: string;
  weekId: string;
}) {
  const result = await loadWeekAndDerivedSections({ familyId, weekId });

  if (!result) {
    return null;
  }

  const itemCount = countGroceryItems(result.derivedSections);

  if (itemCount === 0) {
    throw new Error("This week has no meal ingredients to refresh from.");
  }

  const groceryList = await getDb().groceryList.upsert({
    create: {
      notes: refreshedGroceryListNotes,
      sections: result.derivedSections as unknown as Prisma.InputJsonValue,
      weekId: result.week.id,
    },
    update: {
      notes: refreshedGroceryListNotes,
      sections: result.derivedSections as unknown as Prisma.InputJsonValue,
    },
    where: {
      weekId: result.week.id,
    },
  });

  return {
    groceryList,
    itemCount,
    message: `Refreshed grocery list from ${itemCount} current ingredient${
      itemCount === 1 ? "" : "s"
    }.`,
    weekId: result.week.id,
  };
}
