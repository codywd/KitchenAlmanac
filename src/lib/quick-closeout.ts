import type { MealOutcomeStatus } from "@prisma/client";

import { toDateOnly } from "./dates";
import { routeWithParams } from "./routed-menu";

export type QuickCloseoutMeal = {
  id: string;
  name: string;
  outcomeStatus: MealOutcomeStatus;
};

export type QuickCloseoutPrompt = {
  date: string;
  href: string;
  mealId: string;
  mealName: string;
};

export function closeoutMealHref(weekId: string, mealId: string) {
  return routeWithParams(
    `/weeks/${weekId}/closeout`,
    {},
    {
      mealId,
    },
    `closeout-${mealId}`,
  );
}

export function buildQuickCloseoutPrompts({
  canManage,
  days,
  now = new Date(),
  weekId,
}: {
  canManage: boolean;
  days: Array<{
    date: Date;
    meal: QuickCloseoutMeal | null;
  }>;
  now?: Date;
  weekId: string;
}): QuickCloseoutPrompt[] {
  if (!canManage) {
    return [];
  }

  const today = toDateOnly(now);

  return days
    .filter((day) => toDateOnly(day.date) <= today)
    .flatMap((day) => {
      if (!day.meal || day.meal.outcomeStatus !== "PLANNED") {
        return [];
      }

      return [
        {
          date: toDateOnly(day.date),
          href: closeoutMealHref(weekId, day.meal.id),
          mealId: day.meal.id,
          mealName: day.meal.name,
        },
      ];
    })
    .toSorted((left, right) => right.date.localeCompare(left.date));
}
