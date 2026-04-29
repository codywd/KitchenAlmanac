import type { MealOutcomeStatus } from "@prisma/client";

import { toDateOnly } from "./dates";

type AnalyticsMeal = {
  actualCostCents: number | null;
  budgetFit: boolean;
  costEstimateCents: number | null;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  id: string;
  kidFriendly: boolean;
  name: string;
  noFishSafe: boolean;
  outcomeStatus: MealOutcomeStatus;
  sourceRecipe: unknown;
  weeknightTimeSafe: boolean;
};

type AnalyticsWeek = {
  budgetTargetCents: number | null;
  days: Array<{
    date: Date;
    dinner: AnalyticsMeal | null;
  }>;
  id: string;
  title: string | null;
  weekStart: Date;
};

export type MealAnalyticsInput = {
  weeks: AnalyticsWeek[];
};

export type MealAnalytics = ReturnType<typeof buildMealAnalytics>;

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

const outcomeOrder: MealOutcomeStatus[] = [
  "COOKED",
  "LEFTOVERS",
  "SKIPPED",
  "REPLACED",
  "PLANNED",
];

function sumNullable(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => typeof value === "number");

  return numbers.length ? numbers.reduce((total, value) => total + value, 0) : null;
}

function nutritionLabel(key: string) {
  return (
    nutritionLabels.get(key) ??
    key
      .replace(/_(g|mg)$/u, "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function asNutritionRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const nutrition = (value as { nutrition_estimate_per_serving?: unknown })
    .nutrition_estimate_per_serving;

  return nutrition && typeof nutrition === "object" && !Array.isArray(nutrition)
    ? (nutrition as Record<string, unknown>)
    : null;
}

function mealNutritionEntries(meal: AnalyticsMeal) {
  const nutrition = asNutritionRecord(meal.sourceRecipe);

  if (!nutrition) {
    return [];
  }

  return Object.entries(nutrition).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]),
  );
}

export function buildMealAnalytics(input: MealAnalyticsInput) {
  const weeks = input.weeks.toSorted(
    (left, right) => left.weekStart.getTime() - right.weekStart.getTime(),
  );
  const meals = weeks.flatMap((week) =>
    week.days.flatMap((day) =>
      day.dinner
        ? [
            {
              date: day.date,
              meal: day.dinner,
              week,
            },
          ]
        : [],
    ),
  );
  const actualCostCents = sumNullable(
    meals.map(({ meal }) => meal.actualCostCents),
  );
  const estimatedCostCents = sumNullable(
    meals.map(({ meal }) => meal.costEstimateCents),
  );
  const outcomeMix = outcomeOrder
    .map((status) => ({
      count: meals.filter(({ meal }) => meal.outcomeStatus === status).length,
      status,
    }))
    .filter((entry) => entry.count > 0);
  const weeklyCosts = weeks.map((week) => {
    const weekMeals = week.days.flatMap((day) => (day.dinner ? [day.dinner] : []));
    const estimated = sumNullable(weekMeals.map((meal) => meal.costEstimateCents));
    const actual = sumNullable(weekMeals.map((meal) => meal.actualCostCents));
    const estimatedWithActuals = sumNullable(
      weekMeals
        .filter((meal) => typeof meal.actualCostCents === "number")
        .map((meal) => meal.costEstimateCents),
    );

    return {
      actualCostCents: actual,
      budgetTargetCents: week.budgetTargetCents,
      costDeltaCents:
        typeof actual === "number" && typeof estimatedWithActuals === "number"
          ? actual - estimatedWithActuals
          : null,
      estimatedClosedCostCents: estimatedWithActuals,
      estimatedCostCents: estimated,
      label: week.title ?? `Week of ${toDateOnly(week.weekStart)}`,
      weekId: week.id,
      weekStart: toDateOnly(week.weekStart),
    };
  });
  const biggestEstimateMisses = meals
    .filter(
      ({ meal }) =>
        typeof meal.actualCostCents === "number" &&
        typeof meal.costEstimateCents === "number",
    )
    .map(({ date, meal, week }) => ({
      actualCostCents: meal.actualCostCents!,
      costDeltaCents: meal.actualCostCents! - meal.costEstimateCents!,
      costEstimateCents: meal.costEstimateCents!,
      date: toDateOnly(date),
      mealId: meal.id,
      mealName: meal.name,
      weekId: week.id,
      weekStart: toDateOnly(week.weekStart),
    }))
    .toSorted(
      (left, right) =>
        Math.abs(right.costDeltaCents) - Math.abs(left.costDeltaCents) ||
        right.date.localeCompare(left.date),
    )
    .slice(0, 8);
  const mostExpensiveMeals = meals
    .filter(({ meal }) => typeof meal.actualCostCents === "number")
    .map(({ date, meal, week }) => ({
      actualCostCents: meal.actualCostCents!,
      costEstimateCents: meal.costEstimateCents,
      date: toDateOnly(date),
      mealId: meal.id,
      mealName: meal.name,
      weekId: week.id,
    }))
    .toSorted(
      (left, right) =>
        right.actualCostCents - left.actualCostCents ||
        right.date.localeCompare(left.date),
    )
    .slice(0, 8);
  const healthFlagCoverage = weeks.map((week) => {
    const weekMeals = week.days.flatMap((day) => (day.dinner ? [day.dinner] : []));

    return {
      budgetFit: weekMeals.filter((meal) => meal.budgetFit).length,
      diabetesFriendly: weekMeals.filter((meal) => meal.diabetesFriendly).length,
      heartHealthy: weekMeals.filter((meal) => meal.heartHealthy).length,
      kidFriendly: weekMeals.filter((meal) => meal.kidFriendly).length,
      noFishSafe: weekMeals.filter((meal) => meal.noFishSafe).length,
      plannedDinners: weekMeals.length,
      weekId: week.id,
      weekStart: toDateOnly(week.weekStart),
      weeknightTimeSafe: weekMeals.filter((meal) => meal.weeknightTimeSafe).length,
    };
  });
  const nutritionTotals = new Map<string, { count: number; total: number }>();

  for (const { meal } of meals) {
    for (const [key, value] of mealNutritionEntries(meal)) {
      const current = nutritionTotals.get(key) ?? { count: 0, total: 0 };

      nutritionTotals.set(key, {
        count: current.count + 1,
        total: current.total + value,
      });
    }
  }

  const nutritionAverages = [...nutritionTotals.entries()]
    .map(([key, value]) => ({
      key,
      label: nutritionLabel(key),
      sampleCount: value.count,
      value: Math.round((value.total / value.count) * 10) / 10,
    }))
    .toSorted((left, right) => {
      const leftIndex = nutritionOrder.indexOf(left.key);
      const rightIndex = nutritionOrder.indexOf(right.key);

      if (leftIndex === -1 && rightIndex === -1) {
        return left.label.localeCompare(right.label);
      }

      if (leftIndex === -1) {
        return 1;
      }

      if (rightIndex === -1) {
        return -1;
      }

      return leftIndex - rightIndex;
    });

  return {
    biggestEstimateMisses,
    healthFlagCoverage,
    mostExpensiveMeals,
    nutritionAverages,
    outcomeMix,
    summary: {
      actualCostCents,
      actualVsEstimateCents:
        typeof actualCostCents === "number" && typeof estimatedCostCents === "number"
          ? actualCostCents - estimatedCostCents
          : null,
      estimatedCostCents,
      nutritionSampleCount: meals.filter(({ meal }) => mealNutritionEntries(meal).length)
        .length,
      plannedDinners: meals.length,
      weekCount: weeks.length,
    },
    weeklyCosts,
  };
}
