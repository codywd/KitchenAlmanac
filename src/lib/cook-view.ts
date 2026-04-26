import { formatDisplayDate, formatMoney, toDateOnly } from "./dates";

export type CookIngredient = {
  id: string;
  name: string;
  optional?: boolean;
  pantryItem: boolean;
  preparation?: string;
  quantity: string;
  substitutes: string[];
};

export type CookStep = {
  heat?: string;
  id: string;
  number: number;
  text: string;
  timeMinutes?: number;
};

export type CookNutritionEntry = {
  key: string;
  label: string;
  value: string;
};

export type CookMealNav = {
  dateLabel: string;
  href: string;
  mealName: string;
};

export type CookViewModel = {
  activeMinutes?: number;
  batchPrepNote?: string;
  costLabel: string;
  dateIso: string;
  dateLabel: string;
  difficulty?: string;
  equipment: string[];
  feedbackStatus: string;
  health: {
    changes: string[];
    plateBuild?: string;
    whyItHelps: string[];
  };
  ingredients: CookIngredient[];
  kid: {
    notes: string[];
    serveComponentsSeparately?: boolean;
    strategy?: string;
  };
  leftovers: {
    reuseIdeas: string[];
    storage?: string;
  };
  nextMeal?: CookMealNav;
  nutrition: CookNutritionEntry[];
  previousMeal?: CookMealNav;
  servingNotes: string[];
  servings: number;
  steps: CookStep[];
  tags: string[];
  title: string;
  totalMinutes?: number;
  validationFlags: Array<{
    active: boolean;
    label: string;
  }>;
  weekHref: string;
  weekTitle?: string;
  whyThisWorks?: string;
};

type CookViewMeal = {
  batchPrepNote?: null | string;
  budgetFit: boolean;
  costEstimateCents?: null | number;
  diabetesFriendly: boolean;
  feedbackStatus: string;
  heartHealthy: boolean;
  id: string;
  ingredients: unknown;
  kidAdaptations?: null | string;
  kidFriendly: boolean;
  methodSteps: string[];
  name: string;
  noFishSafe: boolean;
  prepTimeActiveMinutes?: null | number;
  prepTimeTotalMinutes?: null | number;
  servings: number;
  sourceRecipe?: null | unknown;
  weeknightTimeSafe: boolean;
};

type CookViewWeekDay = {
  date: Date;
  mealId?: null | string;
  mealName?: null | string;
};

type CookViewWeek = {
  id: string;
  title?: null | string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => asString(item))
        .filter((item): item is string => Boolean(item))
    : [];
}

function slug(...parts: Array<number | string | undefined>) {
  return (
    parts
      .filter((part) => part !== undefined && String(part).trim())
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "item"
  );
}

function quantityFrom(record: Record<string, unknown>) {
  const quantity = asString(record.quantity);

  if (quantity) {
    return quantity;
  }

  const amount = record.amount;
  const amountText =
    typeof amount === "number" || typeof amount === "string"
      ? String(amount).trim()
      : "";
  const unitText = asString(record.unit) ?? "";

  return [amountText, unitText].filter(Boolean).join(" ") || "as needed";
}

function readIngredient(raw: unknown): CookIngredient | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const name = asString(record.item) ?? asString(record.name);

  if (!name) {
    return null;
  }

  const quantity = quantityFrom(record);
  const ingredient: CookIngredient = {
    id: slug(name, quantity),
    name,
    pantryItem: record.pantryItem === true || record.pantry_item === true,
    quantity,
    substitutes: asStringArray(record.substitutes),
  };

  if (record.optional === true) {
    ingredient.optional = true;
  }

  const preparation = asString(record.preparation);

  if (preparation) {
    ingredient.preparation = preparation;
  }

  return ingredient;
}

function readIngredients(meal: CookViewMeal, sourceRecipe: Record<string, unknown> | null) {
  const mealIngredients = Array.isArray(meal.ingredients)
    ? meal.ingredients
    : [];
  const sourceIngredients = Array.isArray(sourceRecipe?.ingredients)
    ? sourceRecipe.ingredients
    : [];
  const rawIngredients = mealIngredients.length ? mealIngredients : sourceIngredients;

  return rawIngredients
    .map((ingredient) => readIngredient(ingredient))
    .filter((ingredient): ingredient is CookIngredient => Boolean(ingredient));
}

function readInstruction(raw: unknown, fallbackNumber: number): CookStep | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const text = asString(record.text);

  if (!text) {
    return null;
  }

  const number = asNumber(record.step) ?? fallbackNumber;

  return {
    heat: asString(record.heat),
    id: slug(number, text),
    number,
    text,
    timeMinutes: asNumber(record.time_minutes),
  };
}

function readSteps(meal: CookViewMeal, sourceRecipe: Record<string, unknown> | null) {
  const sourceInstructions = Array.isArray(sourceRecipe?.instructions)
    ? sourceRecipe.instructions
    : [];
  const richSteps = sourceInstructions
    .map((instruction, index) => readInstruction(instruction, index + 1))
    .filter((step): step is CookStep => Boolean(step))
    .toSorted((left, right) => left.number - right.number);

  if (richSteps.length) {
    return richSteps.map((step, index) => ({
      ...step,
      number: index + 1,
    }));
  }

  return meal.methodSteps
    .map((text, index) => ({
      id: slug(index + 1, text),
      number: index + 1,
      text,
    }))
    .filter((step) => step.text.trim());
}

const nutritionLabels = new Map([
  ["calories", "Calories"],
  ["carbs_g", "Carbs"],
  ["fiber_g", "Fiber"],
  ["protein_g", "Protein"],
  ["saturated_fat_g", "Sat fat"],
  ["sodium_mg", "Sodium"],
  ["sugars_g", "Sugars"],
  ["total_fat_g", "Fat"],
]);

const nutritionOrder = [
  "calories",
  "protein_g",
  "carbs_g",
  "fiber_g",
  "sugars_g",
  "total_fat_g",
  "saturated_fat_g",
  "sodium_mg",
];

function nutritionLabel(key: string) {
  return (
    nutritionLabels.get(key) ??
    key
      .replace(/_(g|mg)$/u, "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function nutritionValue(key: string, value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (key.endsWith("_g")) {
      return `${value} g`;
    }

    if (key.endsWith("_mg")) {
      return `${value} mg`;
    }

    return String(value);
  }

  return String(value);
}

function readNutrition(sourceRecipe: Record<string, unknown> | null) {
  const nutrition = asRecord(sourceRecipe?.nutrition_estimate_per_serving);

  if (!nutrition) {
    return [];
  }

  return Object.entries(nutrition)
    .toSorted(([left], [right]) => {
      const leftIndex = nutritionOrder.indexOf(left);
      const rightIndex = nutritionOrder.indexOf(right);

      if (leftIndex === -1 && rightIndex === -1) {
        return left.localeCompare(right);
      }

      if (leftIndex === -1) {
        return 1;
      }

      if (rightIndex === -1) {
        return -1;
      }

      return leftIndex - rightIndex;
    })
    .map(([key, value]) => ({
      key,
      label: nutritionLabel(key),
      value: nutritionValue(key, value),
    }));
}

function readMealNav(
  meal: CookViewMeal,
  weekDays: CookViewWeekDay[],
  direction: "next" | "previous",
) {
  const plannedDays = weekDays
    .filter((day) => day.mealId && day.mealName)
    .toSorted((left, right) => left.date.getTime() - right.date.getTime());
  const currentIndex = plannedDays.findIndex((day) => day.mealId === meal.id);
  const target =
    currentIndex === -1
      ? undefined
      : plannedDays[direction === "previous" ? currentIndex - 1 : currentIndex + 1];

  if (!target?.mealId || !target.mealName) {
    return undefined;
  }

  return {
    dateLabel: formatDisplayDate(target.date),
    href: `/cook/${target.mealId}`,
    mealName: target.mealName,
  };
}

export function buildCookViewModel({
  date,
  meal,
  week,
  weekDays,
}: {
  date: Date;
  meal: CookViewMeal;
  week: CookViewWeek;
  weekDays: CookViewWeekDay[];
}): CookViewModel {
  const sourceRecipe = asRecord(meal.sourceRecipe);
  const health = asRecord(sourceRecipe?.health_adjustment);
  const kid = asRecord(sourceRecipe?.kid_friendly_variation);
  const leftovers = asRecord(sourceRecipe?.leftovers);
  const time = asRecord(sourceRecipe?.time);
  const title = asString(sourceRecipe?.dinner_title) ?? meal.name;

  return {
    activeMinutes: asNumber(time?.prep_minutes) ?? meal.prepTimeActiveMinutes ?? undefined,
    batchPrepNote: meal.batchPrepNote ?? undefined,
    costLabel: formatMoney(meal.costEstimateCents),
    dateIso: toDateOnly(date),
    dateLabel: formatDisplayDate(date),
    difficulty: asString(sourceRecipe?.difficulty),
    equipment: asStringArray(sourceRecipe?.equipment),
    feedbackStatus: meal.feedbackStatus.replaceAll("_", " ").toLowerCase(),
    health: {
      changes: asStringArray(health?.changes),
      plateBuild: asString(health?.plate_build),
      whyItHelps: asStringArray(health?.why_it_helps),
    },
    ingredients: readIngredients(meal, sourceRecipe),
    kid: {
      notes: asStringArray(kid?.notes),
      serveComponentsSeparately:
        typeof kid?.serve_components_separately === "boolean"
          ? kid.serve_components_separately
          : undefined,
      strategy: asString(kid?.strategy) ?? meal.kidAdaptations ?? undefined,
    },
    leftovers: {
      reuseIdeas: asStringArray(leftovers?.reuse_ideas),
      storage: asString(leftovers?.storage),
    },
    nextMeal: readMealNav(meal, weekDays, "next"),
    nutrition: readNutrition(sourceRecipe),
    previousMeal: readMealNav(meal, weekDays, "previous"),
    servingNotes: asStringArray(sourceRecipe?.serving_notes),
    servings: meal.servings,
    steps: readSteps(meal, sourceRecipe),
    tags: asStringArray(sourceRecipe?.tags),
    title,
    totalMinutes: asNumber(time?.total_minutes) ?? meal.prepTimeTotalMinutes ?? undefined,
    validationFlags: [
      { active: meal.diabetesFriendly, label: "Diabetes-friendly" },
      { active: meal.heartHealthy, label: "Heart-healthy" },
      { active: meal.noFishSafe, label: "No-fish safe" },
      { active: meal.kidFriendly, label: "Kid-adapted" },
      { active: meal.budgetFit, label: "Budget-fit" },
      { active: meal.weeknightTimeSafe, label: "Weeknight-safe" },
    ],
    weekHref: `/weeks/${week.id}`,
    weekTitle: week.title ?? undefined,
    whyThisWorks: asString(sourceRecipe?.why_this_works),
  };
}
