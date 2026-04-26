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
