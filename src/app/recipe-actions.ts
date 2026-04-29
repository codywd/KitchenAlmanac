"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { addDays, parseDateOnly, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { assertCanManagePlans, requireFamilyContext } from "@/lib/family";
import { parseSavedRecipeFormData } from "@/lib/saved-recipe-form";
import {
  buildSavedRecipeDataFromMeal,
  savedRecipeToMealCreateData,
} from "@/lib/saved-recipes";

export type SavedRecipeActionState = {
  error?: string;
  message?: string;
  recipeId?: string;
};

export type SavedRecipeSwapActionState = {
  error?: string;
  mealId?: string;
  message?: string;
  weekId?: string;
};

function revalidateRecipeSurfaces(weekId?: string) {
  revalidatePath("/meal-memory");
  revalidatePath("/planner");
  revalidatePath("/recipes");

  if (weekId) {
    revalidatePath("/calendar");
    revalidatePath("/ingredients");
    revalidatePath(`/weeks/${weekId}`);
    revalidatePath(`/weeks/${weekId}/closeout`);
    revalidatePath(`/weeks/${weekId}/review`);
  }
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function recipeUpdateData(formData: FormData, userId: string) {
  const parsed = parseSavedRecipeFormData(formData, userId);

  return {
    ...parsed,
    ingredients: parsed.ingredients as Prisma.InputJsonValue,
  };
}

function recipeCreateData(formData: FormData, familyId: string, userId: string) {
  const parsed = parseSavedRecipeFormData(formData, userId);

  return {
    ...parsed,
    createdByUserId: userId,
    familyId,
    ingredients: parsed.ingredients as Prisma.InputJsonValue,
    sourceRecipe: Prisma.JsonNull,
  };
}

export async function saveMealToRecipeLibraryAction(formData: FormData) {
  const context = await requireFamilyContext("/meal-memory");
  assertCanManagePlans(context.role);
  const mealId = text(formData, "mealId");
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
          familyId: context.family.id,
        },
      },
      id: mealId,
    },
  });

  if (!meal) {
    return {
      error: "Meal not found.",
    };
  }

  const data = buildSavedRecipeDataFromMeal({
    familyId: context.family.id,
    meal,
    userId: context.user.id,
  });
  const existing = await getDb().savedRecipe.findFirst({
    select: {
      id: true,
    },
    where: {
      familyId: context.family.id,
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
        ingredients: data.ingredients as Prisma.InputJsonValue,
        sourceRecipe: data.sourceRecipe as Prisma.InputJsonValue,
      },
      where: {
        id: existing.id,
      },
    });

    revalidateRecipeSurfaces(meal.dayPlan.weekId);

    return {
      message: `Updated ${meal.name} in the recipe library.`,
      recipeId: existing.id,
    };
  }

  const recipe = await getDb().savedRecipe.create({
    data: {
      ...data,
      ingredients: data.ingredients as Prisma.InputJsonValue,
      sourceRecipe: data.sourceRecipe as Prisma.InputJsonValue,
    },
  });

  revalidateRecipeSurfaces(meal.dayPlan.weekId);

  return {
    message: `Saved ${meal.name} to the recipe library.`,
    recipeId: recipe.id,
  };
}

export async function saveMealToRecipeLibraryFormAction(formData: FormData) {
  await saveMealToRecipeLibraryAction(formData);
}

export async function createSavedRecipeAction(
  _previousState: SavedRecipeActionState,
  formData: FormData,
): Promise<SavedRecipeActionState> {
  const context = await requireFamilyContext("/recipes/new");
  assertCanManagePlans(context.role);
  let data: ReturnType<typeof recipeCreateData>;

  try {
    data = recipeCreateData(formData, context.family.id, context.user.id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create recipe.",
    };
  }

  const recipe = await getDb().savedRecipe.create({
    data,
  });

  revalidateRecipeSurfaces();

  return {
    message: `Created ${data.name}.`,
    recipeId: recipe.id,
  };
}

export async function updateSavedRecipeAction(
  _previousState: SavedRecipeActionState,
  formData: FormData,
): Promise<SavedRecipeActionState> {
  const context = await requireFamilyContext("/recipes");
  assertCanManagePlans(context.role);
  const recipeId = text(formData, "recipeId");
  let data: ReturnType<typeof recipeUpdateData>;

  try {
    data = recipeUpdateData(formData, context.user.id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update recipe.",
    };
  }

  const recipe = await getDb().savedRecipe.findFirst({
    select: {
      id: true,
    },
    where: {
      familyId: context.family.id,
      id: recipeId,
    },
  });

  if (!recipe) {
    return {
      error: "Recipe not found.",
    };
  }

  const updated = await getDb().savedRecipe.update({
    data,
    where: {
      id: recipe.id,
    },
  });

  revalidateRecipeSurfaces();

  return {
    message: `Updated ${data.name}.`,
    recipeId: updated.id,
  };
}

export async function archiveSavedRecipeAction(formData: FormData) {
  const context = await requireFamilyContext("/recipes");
  assertCanManagePlans(context.role);
  const recipeId = text(formData, "recipeId");
  const active = text(formData, "active") === "true";

  await getDb().savedRecipe.updateMany({
    data: active
      ? {
          active: true,
          archivedAt: null,
          archivedByUserId: null,
          updatedByUserId: context.user.id,
        }
      : {
          active: false,
          archivedAt: new Date(),
          archivedByUserId: context.user.id,
          updatedByUserId: context.user.id,
        },
    where: {
      familyId: context.family.id,
      id: recipeId,
    },
  });

  revalidateRecipeSurfaces();
}

export async function replaceDinnerFromSavedRecipeAction(
  _previousState: SavedRecipeSwapActionState,
  formData: FormData,
): Promise<SavedRecipeSwapActionState> {
  const weekId = text(formData, "weekId");
  const context = await requireFamilyContext(`/weeks/${weekId}/review`);
  assertCanManagePlans(context.role);
  const dateText = text(formData, "date");
  const recipeId = text(formData, "recipeId");
  const date = parseDateOnly(dateText);
  const [week, recipe] = await Promise.all([
    getDb().week.findFirst({
      select: {
        id: true,
        weekStart: true,
      },
      where: {
        familyId: context.family.id,
        id: weekId,
      },
    }),
    getDb().savedRecipe.findFirst({
      where: {
        active: true,
        familyId: context.family.id,
        id: recipeId,
      },
    }),
  ]);

  if (!week) {
    return {
      error: "Week not found.",
    };
  }

  if (!recipe) {
    return {
      error: "Recipe not found.",
    };
  }

  const weekStart = toDateOnly(week.weekStart);
  const weekEnd = toDateOnly(addDays(week.weekStart, 6));

  if (dateText < weekStart || dateText > weekEnd) {
    return {
      error: "Replacement date must be inside the selected week.",
    };
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
        ingredients: mealData.ingredients as Prisma.InputJsonValue,
        sourceRecipe: mealData.sourceRecipe as Prisma.InputJsonValue,
      },
    });
  });

  revalidateRecipeSurfaces(week.id);

  return {
    mealId: meal.id,
    message: `Replaced dinner for ${dateText} from ${recipe.name}. Ingredient rollup updated; stored grocery list may need refresh.`,
    weekId: week.id,
  };
}
