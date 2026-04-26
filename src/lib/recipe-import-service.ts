import { Prisma } from "@prisma/client";

import { getDb } from "./db";
import { normalizeImportedMealPlan } from "./recipe-import";

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
