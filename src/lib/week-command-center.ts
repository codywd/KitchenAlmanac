import type {
  MealFeedbackStatus,
  MealOutcomeStatus,
  ShoppingItemStatus,
} from "@prisma/client";

import { addDays, toDateOnly } from "./dates";
import {
  buildGrocerySectionsFromIngredients,
  countGroceryItems,
  readGrocerySections,
  reconcileGroceryList,
} from "./grocery-reconciliation";
import { aggregateIngredientsForWeek } from "./ingredients";
import { buildShoppingItems, groupShoppingItems } from "./shopping";
import { buildWeekCloseout } from "./week-closeout";
import { buildWeekReview } from "./week-review";
import { summarizeVotes, type MealVoteWithUser } from "./votes";

export type WeekCommandCenterStatus =
  | "attention"
  | "blocked"
  | "done"
  | "ready";

export type WeekCommandCenterStage = {
  actionHref: string | null;
  actionLabel: string;
  detail: string;
  id: "closeout" | "cook" | "learn" | "plan" | "review" | "shop";
  metric: string;
  status: WeekCommandCenterStatus;
  title: string;
};

export type WeekCommandCenterMeal = {
  actualCostCents: number | null;
  budgetFit: boolean;
  costEstimateCents: number | null;
  cuisine: string | null;
  diabetesFriendly: boolean;
  feedbackReason: string | null;
  feedbackStatus: MealFeedbackStatus;
  feedbackTweaks: string | null;
  heartHealthy: boolean;
  id: string;
  ingredients: unknown;
  kidFriendly: boolean;
  leftoverNotes: string | null;
  name: string;
  noFishSafe: boolean;
  outcomeNotes: string | null;
  outcomeStatus: MealOutcomeStatus;
  searchText?: string;
  servings: number;
  sourceRecipe: unknown;
  votes: MealVoteWithUser[];
  weeknightTimeSafe: boolean;
};

export type WeekCommandCenterWeek = {
  budgetTargetCents: number | null;
  days: Array<{
    date: Date;
    dinner: WeekCommandCenterMeal | null;
  }>;
  groceryList: {
    sections: unknown;
  } | null;
  id: string;
  shoppingItemStates: Array<{
    canonicalName: string;
    itemName: string;
    quantity: string | null;
    status: ShoppingItemStatus;
    updatedBy: {
      email: string;
      name: string | null;
    } | null;
  }>;
  title: string | null;
  weekStart: Date;
};

export type WeekCommandCenterRecentWeek = {
  days: Array<{
    date: Date;
    dinner: {
      feedbackStatus: MealFeedbackStatus;
      name: string;
    } | null;
  }>;
  id: string;
  weekStart: Date;
};

export type WeekCommandCenterView = {
  closeout: {
    closedDinners: number;
    dueCount: number;
    plannedDinners: number;
  };
  days: Array<{
    date: string;
    displayDate: string;
    mealId: string | null;
    mealName: string | null;
    needsCloseout: boolean;
    outcomeStatus: MealOutcomeStatus | null;
    validationScore: number | null;
    voteCounts: Record<MealVoteWithUser["vote"], number>;
  }>;
  learn: {
    cookedCount: number;
    likedCount: number;
    rejectedCount: number;
    tweakedCount: number;
  };
  nextAction: {
    detail: string;
    href: string | null;
    label: string;
    stageId: WeekCommandCenterStage["id"];
    title: string;
  };
  review: {
    infoCount: number;
    warningCount: number;
  };
  selectedWeek: {
    id: string;
    label: string;
    weekEnd: string;
    weekStart: string;
  } | null;
  shopping: {
    alreadyHaveCount: number;
    boughtCount: number;
    hasRefreshChanges: boolean;
    itemCount: number;
    neededCount: number;
  };
  stages: WeekCommandCenterStage[];
  stats: {
    missingDinners: number;
    plannedDinners: number;
    totalCostEstimateCents: number | null;
  };
};

type PantryStaple = {
  active: boolean;
  canonicalName: string;
  displayName: string;
};

type RejectedMealSignal = {
  mealName: string;
  patternToAvoid: string;
  reason: string;
};

function weekLabel(week: Pick<WeekCommandCenterWeek, "title" | "weekStart">) {
  return week.title ?? `Week of ${toDateOnly(week.weekStart)}`;
}

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
}

function validationScore(meal: WeekCommandCenterMeal) {
  return [
    meal.diabetesFriendly,
    meal.heartHealthy,
    meal.noFishSafe,
    meal.kidFriendly,
    meal.budgetFit,
    meal.weeknightTimeSafe,
  ].filter(Boolean).length;
}

function daySlots(week: WeekCommandCenterWeek) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week.weekStart, index);
    const dinner =
      week.days.find(
        (day) => toDateOnly(day.date) === toDateOnly(date),
      )?.dinner ?? null;

    return {
      date,
      dinner,
    };
  });
}

function mealSearchText(meal: WeekCommandCenterMeal) {
  return [
    meal.searchText,
    meal.name,
    JSON.stringify(meal.ingredients),
    JSON.stringify(meal.sourceRecipe),
  ]
    .filter(Boolean)
    .join(" ");
}

function costTotal(meals: WeekCommandCenterMeal[]) {
  const costs = meals
    .map((meal) => meal.costEstimateCents)
    .filter((cost): cost is number => typeof cost === "number");

  return costs.length ? costs.reduce((total, cost) => total + cost, 0) : null;
}

function stage({
  actionHref,
  actionLabel,
  detail,
  id,
  metric,
  status,
  title,
}: WeekCommandCenterStage): WeekCommandCenterStage {
  return {
    actionHref,
    actionLabel,
    detail,
    id,
    metric,
    status,
    title,
  };
}

function noWeekView(canManage: boolean): WeekCommandCenterView {
  const planHref = canManage ? "/planner" : null;
  const stages = [
    stage({
      actionHref: planHref,
      actionLabel: canManage ? "Open planner" : "Waiting on owner",
      detail: canManage
        ? "Create or import a week to start the household workflow."
        : "Ask an owner or admin to create the first week.",
      id: "plan",
      metric: "No week",
      status: "attention",
      title: "Plan",
    }),
    stage({
      actionHref: null,
      actionLabel: "Needs a week",
      detail: "Review starts after dinners are planned.",
      id: "review",
      metric: "Blocked",
      status: "blocked",
      title: "Review",
    }),
    stage({
      actionHref: null,
      actionLabel: "Needs groceries",
      detail: "Shopping starts after a plan or grocery list exists.",
      id: "shop",
      metric: "Blocked",
      status: "blocked",
      title: "Shop",
    }),
    stage({
      actionHref: null,
      actionLabel: "Needs dinner",
      detail: "Cook mode appears once a dinner exists.",
      id: "cook",
      metric: "Blocked",
      status: "blocked",
      title: "Cook",
    }),
    stage({
      actionHref: null,
      actionLabel: "Needs outcomes",
      detail: "Closeout starts after dinners are cooked or skipped.",
      id: "closeout",
      metric: "Blocked",
      status: "blocked",
      title: "Closeout",
    }),
    stage({
      actionHref: "/meal-memory",
      actionLabel: "Open memory",
      detail: "Memory will get useful after meals have votes and outcomes.",
      id: "learn",
      metric: "No signals",
      status: "blocked",
      title: "Learn",
    }),
  ];

  return {
    closeout: {
      closedDinners: 0,
      dueCount: 0,
      plannedDinners: 0,
    },
    days: [],
    learn: {
      cookedCount: 0,
      likedCount: 0,
      rejectedCount: 0,
      tweakedCount: 0,
    },
    nextAction: {
      detail: stages[0].detail,
      href: stages[0].actionHref,
      label: stages[0].actionLabel,
      stageId: "plan",
      title: "Start with planning",
    },
    review: {
      infoCount: 0,
      warningCount: 0,
    },
    selectedWeek: null,
    shopping: {
      alreadyHaveCount: 0,
      boughtCount: 0,
      hasRefreshChanges: false,
      itemCount: 0,
      neededCount: 0,
    },
    stages,
    stats: {
      missingDinners: 7,
      plannedDinners: 0,
      totalCostEstimateCents: null,
    },
  };
}

export function buildWeekCommandCenterView({
  activeRejectedMeals,
  canManage,
  pantryStaples,
  relatedWeeks,
  selectedWeek,
  today = new Date(),
}: {
  activeRejectedMeals: RejectedMealSignal[];
  canManage: boolean;
  pantryStaples: PantryStaple[];
  relatedWeeks: WeekCommandCenterRecentWeek[];
  selectedWeek: WeekCommandCenterWeek | null;
  today?: Date;
}): WeekCommandCenterView {
  if (!selectedWeek) {
    return noWeekView(canManage);
  }

  const todayDate = toDateOnly(today);
  const slots = daySlots(selectedWeek);
  const meals = slots.flatMap((slot) => (slot.dinner ? [slot.dinner] : []));
  const ingredients = aggregateIngredientsForWeek(
    slots
      .filter((slot) => slot.dinner)
      .map((slot) => ({
        date: slot.date,
        ingredients: slot.dinner!.ingredients,
        mealName: slot.dinner!.name,
      })),
  );
  const recentMeals = relatedWeeks
    .filter(
      (week) =>
        week.id !== selectedWeek.id && week.weekStart < selectedWeek.weekStart,
    )
    .flatMap((week) =>
      week.days
        .filter((day) => day.dinner)
        .map((day) => ({
          date: toDateOnly(day.date),
          feedbackStatus: day.dinner!.feedbackStatus,
          name: day.dinner!.name,
        })),
    );
  const review = buildWeekReview({
    activeRejectedMeals,
    budgetTargetCents: selectedWeek.budgetTargetCents,
    days: slots.map((slot) => ({
      date: toDateOnly(slot.date),
      meal: slot.dinner
        ? {
            budgetFit: slot.dinner.budgetFit,
            costEstimateCents: slot.dinner.costEstimateCents,
            cuisine: slot.dinner.cuisine,
            diabetesFriendly: slot.dinner.diabetesFriendly,
            heartHealthy: slot.dinner.heartHealthy,
            id: slot.dinner.id,
            kidFriendly: slot.dinner.kidFriendly,
            name: slot.dinner.name,
            noFishSafe: slot.dinner.noFishSafe,
            searchText: mealSearchText(slot.dinner),
            servings: slot.dinner.servings,
            votes: slot.dinner.votes,
            weeknightTimeSafe: slot.dinner.weeknightTimeSafe,
          }
        : null,
    })),
    ingredients,
    recentMeals,
    weekId: selectedWeek.id,
    weekStart: toDateOnly(selectedWeek.weekStart),
  });
  const derivedSections = buildGrocerySectionsFromIngredients(
    ingredients,
    pantryStaples,
  );
  const storedSections = selectedWeek.groceryList
    ? readGrocerySections(selectedWeek.groceryList.sections)
    : null;
  const reconciliation = reconcileGroceryList({
    derivedSections,
    storedSections,
  });
  const shoppingItems = buildShoppingItems({
    derivedSections,
    itemStates: selectedWeek.shoppingItemStates,
    pantryStaples,
    storedSections,
  });
  const shoppingGroups = groupShoppingItems(shoppingItems);
  const closeout = buildWeekCloseout({
    budgetTargetCents: selectedWeek.budgetTargetCents,
    days: slots.map((slot) => ({
      date: toDateOnly(slot.date),
      meal: slot.dinner,
    })),
    weekId: selectedWeek.id,
    weekStart: toDateOnly(selectedWeek.weekStart),
  });
  const dueCloseouts = slots.filter(
    (slot) =>
      toDateOnly(slot.date) <= todayDate &&
      slot.dinner?.outcomeStatus === "PLANNED",
  );
  const nextCookSlot =
    slots.find((slot) => slot.dinner && toDateOnly(slot.date) >= todayDate) ??
    slots.find((slot) => slot.dinner);
  const learnedMeals = meals.filter(
    (meal) =>
      meal.feedbackStatus !== "PLANNED" || meal.outcomeStatus !== "PLANNED",
  );
  const planStatus: WeekCommandCenterStatus =
    meals.length > 0 ? "done" : "attention";
  const reviewStatus: WeekCommandCenterStatus =
    review.stats.totalWarnings > 0 ? "attention" : "done";
  const shopStatus: WeekCommandCenterStatus =
    meals.length === 0
      ? "blocked"
      : reconciliation.hasChanges
        ? "attention"
        : shoppingItems.length > 0
          ? "ready"
          : "blocked";
  const cookStatus: WeekCommandCenterStatus = nextCookSlot?.dinner
    ? "ready"
    : "blocked";
  const closeoutStatus: WeekCommandCenterStatus =
    meals.length === 0
      ? "blocked"
      : dueCloseouts.length > 0
        ? "attention"
        : closeout.stats.closedDinners === closeout.stats.plannedDinners
          ? "done"
          : "ready";
  const learnStatus: WeekCommandCenterStatus =
    learnedMeals.length > 0 ? "ready" : "blocked";
  const planHref = canManage ? "/planner" : null;
  const stages = [
    stage({
      actionHref: planHref,
      actionLabel: canManage ? "Open planner" : "Owner/admin step",
      detail:
        meals.length > 0
          ? `${meals.length}/7 dinners are planned.`
          : "No dinners are planned for this week yet.",
      id: "plan",
      metric: `${meals.length}/7`,
      status: planStatus,
      title: "Plan",
    }),
    stage({
      actionHref: `/weeks/${selectedWeek.id}/review`,
      actionLabel: "Review week",
      detail:
        review.stats.totalWarnings > 0
          ? `${review.stats.totalWarnings} warning${
              review.stats.totalWarnings === 1 ? "" : "s"
            } need attention.`
          : "No review warnings for the current plan.",
      id: "review",
      metric: `${review.stats.totalWarnings} warnings`,
      status: reviewStatus,
      title: "Review",
    }),
    stage({
      actionHref: reconciliation.hasChanges
        ? `/ingredients?weekId=${selectedWeek.id}`
        : `/weeks/${selectedWeek.id}/shopping`,
      actionLabel: reconciliation.hasChanges ? "Refresh list" : "Shop list",
      detail: reconciliation.hasChanges
        ? "Stored groceries differ from current dinners."
        : `${shoppingGroups.NEEDED.length} needed, ${shoppingGroups.BOUGHT.length} bought, ${shoppingGroups.ALREADY_HAVE.length} on hand.`,
      id: "shop",
      metric: `${shoppingGroups.NEEDED.length} needed`,
      status: shopStatus,
      title: "Shop",
    }),
    stage({
      actionHref: nextCookSlot?.dinner ? `/cook/${nextCookSlot.dinner.id}` : null,
      actionLabel: nextCookSlot?.dinner ? "Open cook mode" : "No dinner",
      detail: nextCookSlot?.dinner
        ? `${displayDate(nextCookSlot.date)}: ${nextCookSlot.dinner.name}`
        : "No dinner is available to cook yet.",
      id: "cook",
      metric: nextCookSlot?.dinner ? "Ready" : "Blocked",
      status: cookStatus,
      title: "Cook",
    }),
    stage({
      actionHref: `/weeks/${selectedWeek.id}/closeout`,
      actionLabel: "Close out week",
      detail:
        dueCloseouts.length > 0
          ? `${dueCloseouts.length} dinner${
              dueCloseouts.length === 1 ? "" : "s"
            } need closeout.`
          : "No due dinners are waiting for closeout.",
      id: "closeout",
      metric: `${closeout.stats.closedDinners}/${closeout.stats.plannedDinners}`,
      status: closeoutStatus,
      title: "Closeout",
    }),
    stage({
      actionHref: "/meal-memory",
      actionLabel: "Open memory",
      detail:
        learnedMeals.length > 0
          ? `${learnedMeals.length} meal signal${
              learnedMeals.length === 1 ? "" : "s"
            } can shape future plans.`
          : "Closeouts and feedback will feed future planning.",
      id: "learn",
      metric: `${learnedMeals.length} signals`,
      status: learnStatus,
      title: "Learn",
    }),
  ];
  const nextActionStage =
    stages.find((item) => item.id === "plan" && item.status === "attention") ??
    stages.find((item) => item.id === "review" && item.status === "attention") ??
    stages.find((item) => item.id === "shop" && item.status === "attention") ??
    stages.find((item) => item.id === "shop" && shoppingGroups.NEEDED.length > 0) ??
    stages.find((item) => item.id === "cook" && item.status === "ready") ??
    stages.find((item) => item.id === "closeout" && item.status === "attention") ??
    stages.find((item) => item.id === "learn") ??
    stages[0];

  return {
    closeout: {
      closedDinners: closeout.stats.closedDinners,
      dueCount: dueCloseouts.length,
      plannedDinners: closeout.stats.plannedDinners,
    },
    days: slots.map((slot) => {
      const votes = summarizeVotes(slot.dinner?.votes ?? []);

      return {
        date: toDateOnly(slot.date),
        displayDate: displayDate(slot.date),
        mealId: slot.dinner?.id ?? null,
        mealName: slot.dinner?.name ?? null,
        needsCloseout: slot.dinner?.outcomeStatus === "PLANNED",
        outcomeStatus: slot.dinner?.outcomeStatus ?? null,
        validationScore: slot.dinner ? validationScore(slot.dinner) : null,
        voteCounts: votes.counts,
      };
    }),
    learn: {
      cookedCount: meals.filter((meal) => meal.outcomeStatus === "COOKED").length,
      likedCount: meals.filter((meal) => meal.feedbackStatus === "LIKED").length,
      rejectedCount: meals.filter((meal) => meal.feedbackStatus === "REJECTED")
        .length,
      tweakedCount: meals.filter(
        (meal) => meal.feedbackStatus === "WORKED_WITH_TWEAKS",
      ).length,
    },
    nextAction: {
      detail: nextActionStage.detail,
      href: nextActionStage.actionHref,
      label: nextActionStage.actionLabel,
      stageId: nextActionStage.id,
      title: nextActionStage.title,
    },
    review: {
      infoCount: review.stats.totalInfo,
      warningCount: review.stats.totalWarnings,
    },
    selectedWeek: {
      id: selectedWeek.id,
      label: weekLabel(selectedWeek),
      weekEnd: toDateOnly(addDays(selectedWeek.weekStart, 6)),
      weekStart: toDateOnly(selectedWeek.weekStart),
    },
    shopping: {
      alreadyHaveCount: shoppingGroups.ALREADY_HAVE.length,
      boughtCount: shoppingGroups.BOUGHT.length,
      hasRefreshChanges: reconciliation.hasChanges,
      itemCount: countGroceryItems(
        storedSections?.length ? storedSections : derivedSections,
      ),
      neededCount: shoppingGroups.NEEDED.length,
    },
    stages,
    stats: {
      missingDinners: 7 - meals.length,
      plannedDinners: meals.length,
      totalCostEstimateCents: costTotal(meals),
    },
  };
}
