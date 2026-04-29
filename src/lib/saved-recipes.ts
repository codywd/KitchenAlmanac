import type {
  MealFeedbackStatus,
  MealOutcomeStatus,
} from "@prisma/client";

import { formatMoney, toDateOnly } from "./dates";
import { tagsFromSourceRecipe } from "./saved-recipe-form";

type CopyableMeal = {
  actualCostCents: number | null;
  batchPrepNote: string | null;
  budgetFit: boolean;
  costEstimateCents: number | null;
  cuisine: string | null;
  dayPlan: {
    date: Date;
    week: {
      id: string;
      weekStart: Date;
    };
    weekId: string;
  };
  diabetesFriendly: boolean;
  feedbackReason: string | null;
  feedbackStatus: MealFeedbackStatus;
  feedbackTweaks: string | null;
  heartHealthy: boolean;
  id: string;
  ingredients: unknown;
  kidAdaptations: string | null;
  kidFriendly: boolean;
  methodSteps: string[];
  name: string;
  noFishSafe: boolean;
  outcomeNotes?: string | null;
  outcomeStatus: MealOutcomeStatus;
  leftoverNotes?: string | null;
  prepTimeActiveMinutes: number | null;
  prepTimeTotalMinutes: number | null;
  servings: number;
  sourceRecipe: unknown;
  sourceUrl?: string | null;
  tags?: string[];
  validationNotes: string | null;
  weeknightTimeSafe: boolean;
};

export type SavedRecipeLike = {
  active: boolean;
  actualCostCents: number | null;
  archivedAt: Date | null;
  archivedByUserId: string | null;
  batchPrepNote: string | null;
  budgetFit: boolean;
  costEstimateCents: number | null;
  cuisine: string | null;
  createdAt: Date;
  createdByUserId: string | null;
  diabetesFriendly: boolean;
  familyId: string;
  feedbackReason: string | null;
  feedbackStatus: MealFeedbackStatus | null;
  feedbackTweaks: string | null;
  heartHealthy: boolean;
  id: string;
  ingredients: unknown;
  kidAdaptations: string | null;
  kidFriendly: boolean;
  methodSteps: string[];
  name: string;
  noFishSafe: boolean;
  outcomeNotes?: string | null;
  outcomeStatus: MealOutcomeStatus | null;
  leftoverNotes?: string | null;
  prepTimeActiveMinutes: number | null;
  prepTimeTotalMinutes: number | null;
  servings: number;
  sourceMealDate: Date | null;
  sourceMealId: string | null;
  sourceMealName: string | null;
  sourceRecipe: unknown;
  sourceUrl: string | null;
  sourceWeekId: string | null;
  sourceWeekStart: Date | null;
  tags: string[];
  updatedAt: Date;
  updatedByUserId: string | null;
  validationNotes: string | null;
  weeknightTimeSafe: boolean;
};

export type SavedRecipePlannerContext = {
  costEstimateCents: number | null;
  cuisine: string | null;
  flags: string[];
  id: string;
  name: string;
  prepTimeTotalMinutes: number | null;
  servings: number;
  source: string;
  tags: string[];
};

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function flagsForRecipe(recipe: {
  budgetFit: boolean;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  kidFriendly: boolean;
  noFishSafe: boolean;
  weeknightTimeSafe: boolean;
}) {
  return [
    recipe.diabetesFriendly ? "diabetes friendly" : null,
    recipe.heartHealthy ? "heart healthy" : null,
    recipe.noFishSafe ? "no fish safe" : null,
    recipe.kidFriendly ? "kid friendly" : null,
    recipe.budgetFit ? "budget fit" : null,
    recipe.weeknightTimeSafe ? "weeknight time safe" : null,
  ].filter((flag): flag is string => Boolean(flag));
}

function sourceUrlFromSourceRecipe(sourceRecipe: unknown) {
  if (!sourceRecipe || typeof sourceRecipe !== "object" || Array.isArray(sourceRecipe)) {
    return null;
  }

  const record = sourceRecipe as {
    sourceUrl?: unknown;
    source_url?: unknown;
    url?: unknown;
  };
  const value =
    typeof record.sourceUrl === "string"
      ? record.sourceUrl
      : typeof record.source_url === "string"
        ? record.source_url
        : typeof record.url === "string"
          ? record.url
          : "";

  if (!value.trim()) {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

export function buildSavedRecipeDataFromMeal({
  familyId,
  meal,
  userId,
}: {
  familyId: string;
  meal: CopyableMeal;
  userId: string;
}) {
  return {
    active: true,
    actualCostCents: meal.actualCostCents,
    batchPrepNote: meal.batchPrepNote,
    budgetFit: meal.budgetFit,
    costEstimateCents: meal.costEstimateCents,
    createdByUserId: userId,
    cuisine: meal.cuisine,
    diabetesFriendly: meal.diabetesFriendly,
    familyId,
    feedbackReason: meal.feedbackReason,
    feedbackStatus: meal.feedbackStatus,
    feedbackTweaks: meal.feedbackTweaks,
    heartHealthy: meal.heartHealthy,
    ingredients: cloneJson(meal.ingredients),
    kidAdaptations: meal.kidAdaptations,
    kidFriendly: meal.kidFriendly,
    leftoverNotes: meal.leftoverNotes ?? null,
    methodSteps: [...meal.methodSteps],
    name: meal.name,
    noFishSafe: meal.noFishSafe,
    outcomeNotes: meal.outcomeNotes ?? null,
    outcomeStatus: meal.outcomeStatus,
    prepTimeActiveMinutes: meal.prepTimeActiveMinutes,
    prepTimeTotalMinutes: meal.prepTimeTotalMinutes,
    servings: meal.servings,
    sourceMealDate: meal.dayPlan.date,
    sourceMealId: meal.id,
    sourceMealName: meal.name,
    sourceRecipe: cloneJson(meal.sourceRecipe),
    sourceUrl: meal.sourceUrl ?? sourceUrlFromSourceRecipe(meal.sourceRecipe),
    sourceWeekId: meal.dayPlan.weekId,
    sourceWeekStart: meal.dayPlan.week.weekStart,
    tags: meal.tags ?? tagsFromSourceRecipe(meal.sourceRecipe),
    updatedByUserId: userId,
    validationNotes: meal.validationNotes,
    weeknightTimeSafe: meal.weeknightTimeSafe,
  };
}

function sourceRecipeWithSavedRecipeMetadata(recipe: SavedRecipeLike) {
  const source =
    recipe.sourceRecipe && typeof recipe.sourceRecipe === "object" &&
    !Array.isArray(recipe.sourceRecipe)
      ? cloneJson(recipe.sourceRecipe) as Record<string, unknown>
      : { dinner_title: recipe.name };

  return {
    ...source,
    savedRecipeId: recipe.id,
    savedRecipeName: recipe.name,
    ...(recipe.sourceUrl ? { source_url: recipe.sourceUrl } : {}),
    ...(recipe.tags?.length ? { tags: recipe.tags } : {}),
  };
}

export function savedRecipeToMealCreateData(recipe: SavedRecipeLike) {
  return {
    actualCostCents: null,
    batchPrepNote: recipe.batchPrepNote,
    budgetFit: recipe.budgetFit,
    closedOutAt: null,
    closedOutByUserId: null,
    costEstimateCents: recipe.costEstimateCents,
    cuisine: recipe.cuisine,
    diabetesFriendly: recipe.diabetesFriendly,
    feedbackReason: null,
    feedbackStatus: "PLANNED" as const,
    feedbackTweaks: null,
    heartHealthy: recipe.heartHealthy,
    ingredients: cloneJson(recipe.ingredients),
    kidAdaptations: recipe.kidAdaptations,
    kidFriendly: recipe.kidFriendly,
    leftoverNotes: null,
    methodSteps: [...recipe.methodSteps],
    name: recipe.name,
    noFishSafe: recipe.noFishSafe,
    outcomeNotes: null,
    outcomeStatus: "PLANNED" as const,
    prepTimeActiveMinutes: recipe.prepTimeActiveMinutes,
    prepTimeTotalMinutes: recipe.prepTimeTotalMinutes,
    servings: recipe.servings,
    sourceRecipe: sourceRecipeWithSavedRecipeMetadata(recipe),
    validationNotes: recipe.validationNotes,
    weeknightTimeSafe: recipe.weeknightTimeSafe,
  };
}

function sourceText(recipe: SavedRecipeLike) {
  const parts = [
    recipe.sourceMealDate ? `Saved from ${toDateOnly(recipe.sourceMealDate)}` : "Saved recipe",
    recipe.feedbackStatus
      ? `feedback ${recipe.feedbackStatus.replaceAll("_", " ").toLowerCase()}`
      : null,
    recipe.outcomeStatus
      ? `outcome ${recipe.outcomeStatus.replaceAll("_", " ").toLowerCase()}`
      : null,
  ].filter(Boolean);

  return `${parts.join("; ")}.`;
}

export function savedRecipesForPlannerContext(
  recipes: SavedRecipeLike[],
): SavedRecipePlannerContext[] {
  return recipes
    .filter((recipe) => recipe.active)
    .map((recipe) => ({
      costEstimateCents: recipe.costEstimateCents,
      cuisine: recipe.cuisine,
      flags: flagsForRecipe(recipe),
      id: recipe.id,
      name: recipe.name,
      prepTimeTotalMinutes: recipe.prepTimeTotalMinutes,
      servings: recipe.servings,
      source: sourceText(recipe),
      tags: recipe.tags ?? [],
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function savedRecipePlannerLine(recipe: SavedRecipePlannerContext) {
  const tags = recipe.tags ?? [];

  return `- ${recipe.name}${recipe.cuisine ? ` (${recipe.cuisine})` : ""}: serves ${
    recipe.servings
  }${
    typeof recipe.prepTimeTotalMinutes === "number"
      ? `; total time ${recipe.prepTimeTotalMinutes} min`
      : ""
  }; cost ${formatMoney(recipe.costEstimateCents)}${
    recipe.flags.length ? `; flags: ${recipe.flags.join(", ")}` : ""
  }${tags.length ? `; tags: ${tags.join(", ")}` : ""}; ${
    recipe.source
  }`;
}
