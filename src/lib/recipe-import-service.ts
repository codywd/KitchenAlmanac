import { Prisma } from "@prisma/client";

import { addDays, toDateOnly } from "./dates";
import { getDb } from "./db";
import { normalizeImportedMealPlan } from "./recipe-import";

function assertNoImportPersistenceBlockers(
  normalized: ReturnType<typeof normalizeImportedMealPlan>,
  weekStart: Date,
) {
  const weekStartText = toDateOnly(weekStart);
  const weekEndText = toDateOnly(addDays(weekStart, 6));
  const seenDates = new Map<string, string>();
  const blockers: string[] = [];

  for (const imported of normalized.meals) {
    const dateText = toDateOnly(imported.date);
    const previousMealName = seenDates.get(dateText);

    if (previousMealName) {
      blockers.push(
        `Duplicate Dinner Date: ${imported.meal.name} lands on ${dateText}, already used by ${previousMealName}.`,
      );
    }

    seenDates.set(dateText, imported.meal.name);

    if (dateText < weekStartText || dateText > weekEndText) {
      blockers.push(
        `Dinner Outside Target Week: ${imported.meal.name} maps to ${dateText}, outside ${weekStartText} through ${weekEndText}.`,
      );
    }
  }

  if (blockers.length) {
    throw new Error(`Resolve import blockers before saving: ${blockers.join(" ")}`);
  }
}

export async function importMealPlanForFamily({
  familyId,
  plan,
  weekStart,
}: {
  familyId: string;
  plan: unknown;
  weekStart: Date;
}) {
  const normalized = normalizeImportedMealPlan({ plan, weekStart });
  assertNoImportPersistenceBlockers(normalized, weekStart);
  const db = getDb();

  return db.$transaction(async (tx) => {
    const week = await tx.week.upsert({
      create: {
        budgetTargetCents: normalized.week.budgetTargetCents,
        familyId,
        notes: normalized.week.notes,
        sourceImport: normalized.week.sourceImport as Prisma.InputJsonValue,
        title: normalized.week.title,
        weekStart,
      },
      update: {
        budgetTargetCents: normalized.week.budgetTargetCents,
        notes: normalized.week.notes,
        sourceImport: normalized.week.sourceImport as Prisma.InputJsonValue,
        title: normalized.week.title,
      },
      where: {
        familyId_weekStart: {
          familyId,
          weekStart,
        },
      },
    });

    for (const imported of normalized.meals) {
      const day = await tx.dayPlan.upsert({
        create: {
          date: imported.date,
          weekId: week.id,
        },
        update: {},
        where: {
          weekId_date: {
            date: imported.date,
            weekId: week.id,
          },
        },
      });

      await tx.meal.upsert({
        create: {
          ...imported.meal,
          dayPlanId: day.id,
          ingredients: imported.meal.ingredients as Prisma.InputJsonValue,
          sourceRecipe: imported.meal.sourceRecipe as Prisma.InputJsonValue,
        },
        update: {
          ...imported.meal,
          feedbackReason: null,
          feedbackStatus: "PLANNED",
          feedbackTweaks: null,
          ingredients: imported.meal.ingredients as Prisma.InputJsonValue,
          sourceRecipe: imported.meal.sourceRecipe as Prisma.InputJsonValue,
        },
        where: {
          dayPlanId: day.id,
        },
      });
    }

    if (normalized.groceryList) {
      await tx.groceryList.upsert({
        create: {
          notes: normalized.groceryList.notes,
          sections: normalized.groceryList.sections as Prisma.InputJsonValue,
          weekId: week.id,
        },
        update: {
          notes: normalized.groceryList.notes,
          sections: normalized.groceryList.sections as Prisma.InputJsonValue,
        },
        where: {
          weekId: week.id,
        },
      });
    }

    return {
      importedRecipeCount: normalized.meals.length,
      week: await tx.week.findUniqueOrThrow({
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
          id: week.id,
        },
      }),
    };
  });
}
