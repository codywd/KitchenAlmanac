import { Prisma } from "@prisma/client";
import type { z } from "zod";

import { addDays, parseDateOnly, toDateOnly } from "./dates";
import { getDb } from "./db";
import {
  buildSavedRecipeDataFromMeal,
  savedRecipeToMealCreateData,
} from "./saved-recipes";
import type {
  savedRecipeCreateSchema,
  savedRecipePatchSchema,
} from "./schemas";

type SavedRecipeCreatePayload = z.infer<typeof savedRecipeCreateSchema>;
type SavedRecipePatchPayload = z.infer<typeof savedRecipePatchSchema>;
type ActiveFilter = "true" | "false" | "all";

function activeWhere(active: ActiveFilter) {
  if (active === "all") {
    return {};
  }

  return {
    active: active === "true",
  };
}

function jsonInput(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function savedRecipeCreateData({
  familyId,
  payload,
  userId,
}: {
  familyId: string;
  payload: SavedRecipeCreatePayload;
  userId: string;
}) {
  return {
    active: payload.active,
    actualCostCents: payload.actualCostCents ?? null,
    batchPrepNote: payload.batchPrepNote ?? null,
    budgetFit: payload.validation.budgetFit,
    costEstimateCents: payload.costEstimateCents ?? null,
    createdByUserId: userId,
    cuisine: payload.cuisine ?? null,
    diabetesFriendly: payload.validation.diabetesFriendly,
    familyId,
    feedbackReason: payload.feedbackReason ?? null,
    feedbackStatus: payload.feedbackStatus ?? null,
    feedbackTweaks: payload.feedbackTweaks ?? null,
    heartHealthy: payload.validation.heartHealthy,
    ingredients: jsonInput(payload.ingredients),
    kidAdaptations: payload.kidAdaptations ?? null,
    kidFriendly: payload.validation.kidFriendly,
    leftoverNotes: payload.leftoverNotes ?? null,
    methodSteps: payload.methodSteps,
    name: payload.name,
    noFishSafe: payload.validation.noFishSafe,
    outcomeNotes: payload.outcomeNotes ?? null,
    outcomeStatus: payload.outcomeStatus ?? null,
    prepTimeActiveMinutes: payload.prepTimeActiveMinutes ?? null,
    prepTimeTotalMinutes: payload.prepTimeTotalMinutes ?? null,
    servings: payload.servings,
    sourceRecipe:
      payload.sourceRecipe === undefined
        ? undefined
        : jsonInput(payload.sourceRecipe),
    updatedByUserId: userId,
    validationNotes: payload.validation.validationNotes ?? null,
    weeknightTimeSafe: payload.validation.weeknightTimeSafe,
  };
}

function savedRecipePatchData({
  payload,
  userId,
}: {
  payload: SavedRecipePatchPayload;
  userId: string;
}) {
  return {
    ...(payload.active === true
      ? {
          active: true,
          archivedAt: null,
          archivedByUserId: null,
        }
      : {}),
    ...(payload.active === false
      ? {
          active: false,
          archivedAt: new Date(),
          archivedByUserId: userId,
        }
      : {}),
    ...(payload.actualCostCents !== undefined
      ? { actualCostCents: payload.actualCostCents }
      : {}),
    ...(payload.batchPrepNote !== undefined
      ? { batchPrepNote: payload.batchPrepNote }
      : {}),
    ...(payload.costEstimateCents !== undefined
      ? { costEstimateCents: payload.costEstimateCents }
      : {}),
    ...(payload.cuisine !== undefined ? { cuisine: payload.cuisine } : {}),
    ...(payload.feedbackReason !== undefined
      ? { feedbackReason: payload.feedbackReason }
      : {}),
    ...(payload.feedbackStatus !== undefined
      ? { feedbackStatus: payload.feedbackStatus }
      : {}),
    ...(payload.feedbackTweaks !== undefined
      ? { feedbackTweaks: payload.feedbackTweaks }
      : {}),
    ...(payload.ingredients !== undefined
      ? { ingredients: jsonInput(payload.ingredients) }
      : {}),
    ...(payload.kidAdaptations !== undefined
      ? { kidAdaptations: payload.kidAdaptations }
      : {}),
    ...(payload.leftoverNotes !== undefined
      ? { leftoverNotes: payload.leftoverNotes }
      : {}),
    ...(payload.methodSteps !== undefined ? { methodSteps: payload.methodSteps } : {}),
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.outcomeNotes !== undefined
      ? { outcomeNotes: payload.outcomeNotes }
      : {}),
    ...(payload.outcomeStatus !== undefined
      ? { outcomeStatus: payload.outcomeStatus }
      : {}),
    ...(payload.prepTimeActiveMinutes !== undefined
      ? { prepTimeActiveMinutes: payload.prepTimeActiveMinutes }
      : {}),
    ...(payload.prepTimeTotalMinutes !== undefined
      ? { prepTimeTotalMinutes: payload.prepTimeTotalMinutes }
      : {}),
    ...(payload.servings !== undefined ? { servings: payload.servings } : {}),
    ...(payload.sourceRecipe !== undefined
      ? { sourceRecipe: jsonInput(payload.sourceRecipe) }
      : {}),
    ...(payload.validation?.budgetFit !== undefined
      ? { budgetFit: payload.validation.budgetFit }
      : {}),
    ...(payload.validation?.diabetesFriendly !== undefined
      ? { diabetesFriendly: payload.validation.diabetesFriendly }
      : {}),
    ...(payload.validation?.heartHealthy !== undefined
      ? { heartHealthy: payload.validation.heartHealthy }
      : {}),
    ...(payload.validation?.kidFriendly !== undefined
      ? { kidFriendly: payload.validation.kidFriendly }
      : {}),
    ...(payload.validation?.noFishSafe !== undefined
      ? { noFishSafe: payload.validation.noFishSafe }
      : {}),
    ...(payload.validation?.validationNotes !== undefined
      ? { validationNotes: payload.validation.validationNotes }
      : {}),
    ...(payload.validation?.weeknightTimeSafe !== undefined
      ? { weeknightTimeSafe: payload.validation.weeknightTimeSafe }
      : {}),
    updatedByUserId: userId,
  };
}

export async function listSavedRecipesForFamily({
  active,
  familyId,
}: {
  active: ActiveFilter;
  familyId: string;
}) {
  return getDb().savedRecipe.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    where: {
      familyId,
      ...activeWhere(active),
    },
  });
}

export async function getSavedRecipeForFamily({
  familyId,
  recipeId,
}: {
  familyId: string;
  recipeId: string;
}) {
  return getDb().savedRecipe.findFirst({
    where: {
      familyId,
      id: recipeId,
    },
  });
}

export async function createSavedRecipeForFamily({
  familyId,
  payload,
  userId,
}: {
  familyId: string;
  payload: SavedRecipeCreatePayload;
  userId: string;
}) {
  return getDb().savedRecipe.create({
    data: savedRecipeCreateData({ familyId, payload, userId }),
  });
}

export async function updateSavedRecipeForFamily({
  familyId,
  payload,
  recipeId,
  userId,
}: {
  familyId: string;
  payload: SavedRecipePatchPayload;
  recipeId: string;
  userId: string;
}) {
  const existing = await getDb().savedRecipe.findFirst({
    select: {
      id: true,
    },
    where: {
      familyId,
      id: recipeId,
    },
  });

  if (!existing) {
    return null;
  }

  return getDb().savedRecipe.update({
    data: savedRecipePatchData({ payload, userId }),
    where: {
      id: existing.id,
    },
  });
}

export async function saveMealToRecipeLibraryForFamily({
  familyId,
  mealId,
  userId,
}: {
  familyId: string;
  mealId: string;
  userId: string;
}) {
  const meal = await getDb().meal.findFirst({
    include: {
      dayPlan: {
        include: {
          week: {
            select: {
              id: true,
              weekStart: true,
            },
          },
        },
      },
    },
    where: {
      dayPlan: {
        week: {
          familyId,
        },
      },
      id: mealId,
    },
  });

  if (!meal) {
    return null;
  }

  const data = buildSavedRecipeDataFromMeal({
    familyId,
    meal,
    userId,
  });
  const existing = await getDb().savedRecipe.findFirst({
    select: {
      id: true,
    },
    where: {
      familyId,
      sourceMealId: meal.id,
    },
  });

  if (existing) {
    await getDb().savedRecipe.update({
      data: {
        ...data,
        active: true,
        archivedAt: null,
        archivedByUserId: null,
        ingredients: jsonInput(data.ingredients),
        sourceRecipe: jsonInput(data.sourceRecipe),
      },
      where: {
        id: existing.id,
      },
    });

    return {
      message: `Updated ${meal.name} in the recipe library.`,
      recipeId: existing.id,
      weekId: meal.dayPlan.weekId,
    };
  }

  const recipe = await getDb().savedRecipe.create({
    data: {
      ...data,
      ingredients: jsonInput(data.ingredients),
      sourceRecipe: jsonInput(data.sourceRecipe),
    },
  });

  return {
    message: `Saved ${meal.name} to the recipe library.`,
    recipeId: recipe.id,
    weekId: meal.dayPlan.weekId,
  };
}

export async function replaceDinnerFromSavedRecipeForFamily({
  dateText,
  familyId,
  recipeId,
  weekId,
}: {
  dateText: string;
  familyId: string;
  recipeId: string;
  weekId: string;
}) {
  const date = parseDateOnly(dateText);
  const [week, recipe] = await Promise.all([
    getDb().week.findFirst({
      select: {
        id: true,
        weekStart: true,
      },
      where: {
        familyId,
        id: weekId,
      },
    }),
    getDb().savedRecipe.findFirst({
      where: {
        active: true,
        familyId,
        id: recipeId,
      },
    }),
  ]);

  if (!week) {
    throw new Error("Week not found.");
  }

  if (!recipe) {
    throw new Error("Recipe not found.");
  }

  const weekStart = toDateOnly(week.weekStart);
  const weekEnd = toDateOnly(addDays(week.weekStart, 6));

  if (dateText < weekStart || dateText > weekEnd) {
    throw new Error("Replacement date must be inside the selected week.");
  }

  const mealData = savedRecipeToMealCreateData(recipe);
  const meal = await getDb().$transaction(async (tx) => {
    const day = await tx.dayPlan.upsert({
      create: {
        date,
        weekId: week.id,
      },
      update: {},
      where: {
        weekId_date: {
          date,
          weekId: week.id,
        },
      },
    });

    await tx.meal.deleteMany({
      where: {
        dayPlanId: day.id,
      },
    });

    return tx.meal.create({
      data: {
        ...mealData,
        dayPlanId: day.id,
        ingredients: jsonInput(mealData.ingredients),
        sourceRecipe: jsonInput(mealData.sourceRecipe),
      },
    });
  });

  return {
    mealId: meal.id,
    message: `Replaced dinner for ${dateText} from ${recipe.name}. Ingredient rollup updated; stored grocery list may need refresh.`,
    weekId: week.id,
  };
}
