"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { addDays, parseDateOnly, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { assertCanManagePlans, requireFamilyContext } from "@/lib/family";
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

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);

  return value || null;
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function parseOptionalInteger(value: string, label: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }

  return parsed;
}

function parseServings(value: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Servings must be a positive whole number.");
  }

  return parsed;
}

function parseCostEstimateCents(value: string) {
  if (!value) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error("Cost estimate must be a positive dollar amount.");
  }

  return Math.round(Number(value) * 100);
}

function parseIngredients(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("Ingredients must be a JSON array.");
    }

    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        throw new Error("Each ingredient must be an object.");
      }

      const record = item as { item?: unknown; name?: unknown };
      const name = typeof record.item === "string" ? record.item : record.name;

      if (typeof name !== "string" || !name.trim()) {
        throw new Error("Each ingredient needs an item or name.");
      }
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Ingredients must be valid JSON.");
    }

    throw error;
  }
}

function recipeUpdateData(formData: FormData, userId: string) {
  const name = text(formData, "name");

  if (!name) {
    throw new Error("Name the recipe before saving it.");
  }

  return {
    active: checkbox(formData, "active"),
    batchPrepNote: optionalText(formData, "batchPrepNote"),
    budgetFit: checkbox(formData, "budgetFit"),
    costEstimateCents: parseCostEstimateCents(text(formData, "costEstimateDollars")),
    cuisine: optionalText(formData, "cuisine"),
    diabetesFriendly: checkbox(formData, "diabetesFriendly"),
    heartHealthy: checkbox(formData, "heartHealthy"),
    ingredients: parseIngredients(text(formData, "ingredientsJson")) as Prisma.InputJsonValue,
    kidAdaptations: optionalText(formData, "kidAdaptations"),
    kidFriendly: checkbox(formData, "kidFriendly"),
    methodSteps: text(formData, "methodStepsText")
      .split(/\r?\n/)
      .map((step) => step.trim())
      .filter(Boolean),
    name,
    noFishSafe: checkbox(formData, "noFishSafe"),
    prepTimeActiveMinutes: parseOptionalInteger(
      text(formData, "prepTimeActiveMinutes"),
      "Active prep time",
    ),
    prepTimeTotalMinutes: parseOptionalInteger(
      text(formData, "prepTimeTotalMinutes"),
      "Total prep time",
    ),
    servings: parseServings(text(formData, "servings")),
    updatedByUserId: userId,
    validationNotes: optionalText(formData, "validationNotes"),
    weeknightTimeSafe: checkbox(formData, "weeknightTimeSafe"),
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
