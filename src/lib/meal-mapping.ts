import type { z } from "zod";

import type { mealPatchSchema, mealUpsertSchema } from "./schemas";

type MealPayload = z.infer<typeof mealUpsertSchema>;
type MealPatchPayload = z.infer<typeof mealPatchSchema>;

export function mealCreateData(payload: MealPayload) {
  return {
    batchPrepNote: payload.batchPrepNote,
    budgetFit: payload.validation.budgetFit,
    costEstimateCents: payload.costEstimateCents,
    cuisine: payload.cuisine,
    diabetesFriendly: payload.validation.diabetesFriendly,
    heartHealthy: payload.validation.heartHealthy,
    ingredients: payload.ingredients,
    kidAdaptations: payload.kidAdaptations,
    kidFriendly: payload.validation.kidFriendly,
    methodSteps: payload.methodSteps,
    name: payload.name,
    noFishSafe: payload.validation.noFishSafe,
    prepTimeActiveMinutes: payload.prepTimeActiveMinutes,
    prepTimeTotalMinutes: payload.prepTimeTotalMinutes,
    servings: payload.servings,
    validationNotes: payload.validation.validationNotes,
    weeknightTimeSafe: payload.validation.weeknightTimeSafe,
  };
}

export function mealPatchData(payload: MealPatchPayload) {
  return {
    ...(payload.batchPrepNote !== undefined
      ? { batchPrepNote: payload.batchPrepNote }
      : {}),
    ...(payload.costEstimateCents !== undefined
      ? { costEstimateCents: payload.costEstimateCents }
      : {}),
    ...(payload.cuisine !== undefined ? { cuisine: payload.cuisine } : {}),
    ...(payload.ingredients !== undefined ? { ingredients: payload.ingredients } : {}),
    ...(payload.kidAdaptations !== undefined
      ? { kidAdaptations: payload.kidAdaptations }
      : {}),
    ...(payload.methodSteps !== undefined ? { methodSteps: payload.methodSteps } : {}),
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.prepTimeActiveMinutes !== undefined
      ? { prepTimeActiveMinutes: payload.prepTimeActiveMinutes }
      : {}),
    ...(payload.prepTimeTotalMinutes !== undefined
      ? { prepTimeTotalMinutes: payload.prepTimeTotalMinutes }
      : {}),
    ...(payload.servings !== undefined ? { servings: payload.servings } : {}),
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
  };
}
