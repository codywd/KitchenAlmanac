import type { MealFeedbackStatus, MealVoteValue } from "@prisma/client";

import { addDays, formatMoney, toDateOnly } from "./dates";
import { normalizeImportedMealPlan } from "./recipe-import";

export type ImportReviewContext = {
  activeRejectedMeals: Array<{
    mealName: string;
    patternToAvoid: string;
    reason: string;
  }>;
  budgetTargetCents: number | null;
  recentMeals: Array<{
    date: string;
    feedbackStatus: MealFeedbackStatus;
    name: string;
  }>;
  recentVotes: Array<{
    comment: string | null;
    mealName: string;
    vote: MealVoteValue;
    voterEmail: string;
    voterName: string | null;
  }>;
};

export type ImportReviewPlanningContext = {
  activeRejectedMeals: Array<{
    mealName: string;
    patternToAvoid: string;
    reason: string;
  }>;
  recentMeals: Array<{
    date: string;
    feedbackStatus: MealFeedbackStatus;
    name: string;
  }>;
  recentVotes: Array<{
    comment: string | null;
    mealName: string;
    vote: MealVoteValue;
    voterEmail: string;
    voterName: string | null;
  }>;
};

export type ImportReviewIssue = {
  date?: string;
  detail: string;
  mealName?: string;
  severity: "blocker" | "info" | "warning";
  title: string;
};

export type ImportReviewDayPreview = {
  costEstimateCents: number | null;
  date: string;
  flags: string[];
  issueCount: number;
  mealName: string;
};

export type ImportReviewGrocerySummary = {
  itemCount: number;
  sectionCount: number;
  sections: Array<{
    itemCount: number;
    name: string;
  }>;
};

export type ImportReview = {
  blockingIssues: ImportReviewIssue[];
  budgetTargetCents: number | null;
  canImport: boolean;
  dayPreviews: ImportReviewDayPreview[];
  estimatedGroceryTotalCents: number | null;
  grocerySummary: ImportReviewGrocerySummary;
  issues: ImportReviewIssue[];
  recipeCount: number;
  title: string;
  weekEnd: string;
  weekStart: string;
};

export function toImportReviewContext({
  budgetTargetCents,
  planningContext,
}: {
  budgetTargetCents: number | null;
  planningContext: ImportReviewPlanningContext;
}): ImportReviewContext {
  return {
    activeRejectedMeals: planningContext.activeRejectedMeals.map((meal) => ({
      mealName: meal.mealName,
      patternToAvoid: meal.patternToAvoid,
      reason: meal.reason,
    })),
    budgetTargetCents,
    recentMeals: planningContext.recentMeals.map((meal) => ({
      date: meal.date,
      feedbackStatus: meal.feedbackStatus,
      name: meal.name,
    })),
    recentVotes: planningContext.recentVotes.map((vote) => ({
      comment: vote.comment,
      mealName: vote.mealName,
      vote: vote.vote,
      voterEmail: vote.voterEmail,
      voterName: vote.voterName,
    })),
  };
}

function centsFromUsd(value: unknown) {
  return typeof value === "number" ? Math.round(value * 100) : null;
}

function normalizedSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactTokens(value: string) {
  return normalizedSearchText(value)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function namesMatch(left: string, right: string) {
  const normalizedLeft = normalizedSearchText(left);
  const normalizedRight = normalizedSearchText(right);

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function patternMatches(candidate: string, pattern: string) {
  if (namesMatch(candidate, pattern)) {
    return true;
  }

  const candidateTokens = new Set(compactTokens(candidate));
  const patternTokens = compactTokens(pattern);

  return (
    patternTokens.length > 0 &&
    patternTokens.every((token) => candidateTokens.has(token))
  );
}

function personLabel(person: { voterEmail: string; voterName: string | null }) {
  return person.voterName?.trim() || person.voterEmail;
}

function flagLabels(meal: {
  budgetFit: boolean;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  kidFriendly: boolean;
  noFishSafe: boolean;
  weeknightTimeSafe: boolean;
}) {
  return [
    meal.diabetesFriendly ? "diabetes friendly" : null,
    meal.heartHealthy ? "heart healthy" : null,
    meal.noFishSafe ? "no fish safe" : null,
    meal.kidFriendly ? "kid friendly" : null,
    meal.budgetFit ? "budget fit" : null,
    meal.weeknightTimeSafe ? "weeknight time safe" : null,
  ].filter((flag): flag is string => Boolean(flag));
}

function missingFlagLabels(meal: {
  budgetFit: boolean;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  kidFriendly: boolean;
  noFishSafe: boolean;
  weeknightTimeSafe: boolean;
}) {
  return [
    meal.diabetesFriendly ? null : "diabetes friendly",
    meal.heartHealthy ? null : "heart healthy",
    meal.noFishSafe ? null : "no fish safe",
    meal.kidFriendly ? null : "kid friendly",
    meal.budgetFit ? null : "budget fit",
    meal.weeknightTimeSafe ? null : "weeknight time safe",
  ].filter((flag): flag is string => Boolean(flag));
}

function grocerySummary(
  groceryList: ReturnType<typeof normalizeImportedMealPlan>["groceryList"],
): ImportReviewGrocerySummary {
  const sections = groceryList?.sections ?? [];

  return {
    itemCount: sections.reduce((total, section) => total + section.items.length, 0),
    sectionCount: sections.length,
    sections: sections.map((section) => ({
      itemCount: section.items.length,
      name: section.name,
    })),
  };
}

function countIssuesForMeal(issues: ImportReviewIssue[], mealName: string, date: string) {
  return issues.filter(
    (issue) => issue.mealName === mealName || issue.date === date,
  ).length;
}

export function buildImportReview({
  context,
  plan,
  weekStart,
}: {
  context: ImportReviewContext;
  plan: unknown;
  weekStart: Date;
}): ImportReview {
  const normalized = normalizeImportedMealPlan({ plan, weekStart });
  const weekStartText = toDateOnly(weekStart);
  const weekEnd = addDays(weekStart, 6);
  const weekEndText = toDateOnly(weekEnd);
  const issues: ImportReviewIssue[] = [];
  const seenDates = new Map<string, string>();
  const groceryTotalCents = centsFromUsd(
    (normalized.week.sourceImport as {
      weekly_overview?: {
        estimated_total_grocery_cost_usd?: unknown;
      };
    }).weekly_overview?.estimated_total_grocery_cost_usd,
  );
  const budgetTargetCents =
    context.budgetTargetCents ?? normalized.week.budgetTargetCents ?? null;

  if (
    typeof groceryTotalCents === "number" &&
    typeof budgetTargetCents === "number" &&
    groceryTotalCents > budgetTargetCents
  ) {
    issues.push({
      detail: `Estimated groceries are ${formatMoney(
        groceryTotalCents,
      )}, above the ${formatMoney(budgetTargetCents)} target.`,
      severity: "warning",
      title: "Over Budget Target",
    });
  }

  for (const meal of normalized.meals) {
    const date = toDateOnly(meal.date);
    const previousMealName = seenDates.get(date);

    if (previousMealName) {
      issues.push({
        date,
        detail: `${meal.meal.name} lands on the same date as ${previousMealName}. Importing would overwrite one dinner slot.`,
        mealName: meal.meal.name,
        severity: "blocker",
        title: "Duplicate Dinner Date",
      });
    }

    seenDates.set(date, meal.meal.name);

    if (date < weekStartText || date > weekEndText) {
      issues.push({
        date,
        detail: `${meal.meal.name} maps outside ${weekStartText} through ${weekEndText}.`,
        mealName: meal.meal.name,
        severity: "blocker",
        title: "Dinner Outside Target Week",
      });
    }

    for (const rejected of context.activeRejectedMeals) {
      if (
        patternMatches(meal.meal.name, rejected.mealName) ||
        patternMatches(JSON.stringify(meal.meal.sourceRecipe), rejected.patternToAvoid)
      ) {
        issues.push({
          date,
          detail: `${rejected.reason} Avoid pattern: ${rejected.patternToAvoid}.`,
          mealName: meal.meal.name,
          severity: "warning",
          title: "Active Rejection Match",
        });
      }
    }

    const repeatedMeal = context.recentMeals.find((recent) =>
      namesMatch(meal.meal.name, recent.name),
    );

    if (repeatedMeal) {
      issues.push({
        date,
        detail: `Recently served on ${repeatedMeal.date} with feedback status ${repeatedMeal.feedbackStatus.toLowerCase()}.`,
        mealName: meal.meal.name,
        severity: "warning",
        title: "Recent Repeat",
      });
    }

    for (const vote of context.recentVotes.filter((recentVote) =>
      namesMatch(meal.meal.name, recentVote.mealName),
    )) {
      if (vote.vote === "NO") {
        issues.push({
          date,
          detail: `${personLabel(vote)} recently voted No${
            vote.comment ? `: ${vote.comment}` : "."
          }`,
          mealName: meal.meal.name,
          severity: "warning",
          title: "Recent No Vote",
        });
      } else if (vote.vote === "WANT") {
        issues.push({
          date,
          detail: `${personLabel(vote)} recently voted Want${
            vote.comment ? `: ${vote.comment}` : "."
          }`,
          mealName: meal.meal.name,
          severity: "info",
          title: "Recent Want Vote",
        });
      }
    }

    const missingFlags = missingFlagLabels(meal.meal);

    if (missingFlags.length > 0) {
      issues.push({
        date,
        detail: `Missing or unclaimed flags: ${missingFlags.join(", ")}.`,
        mealName: meal.meal.name,
        severity: "warning",
        title: "Missing Planning Flags",
      });
    }
  }

  if (normalized.meals.length !== 7) {
    issues.push({
      detail: `The import contains ${normalized.meals.length} dinners. The planner expects one dinner for each of 7 dates.`,
      severity: "warning",
      title: "Not A Seven-Day Plan",
    });
  }

  const dayPreviews = normalized.meals
    .map((meal) => {
      const date = toDateOnly(meal.date);

      return {
        costEstimateCents: meal.meal.costEstimateCents ?? null,
        date,
        flags: flagLabels(meal.meal),
        issueCount: countIssuesForMeal(issues, meal.meal.name, date),
        mealName: meal.meal.name,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
  const blockingIssues = issues.filter((issue) => issue.severity === "blocker");

  return {
    blockingIssues,
    budgetTargetCents,
    canImport: blockingIssues.length === 0,
    dayPreviews,
    estimatedGroceryTotalCents: groceryTotalCents,
    grocerySummary: grocerySummary(normalized.groceryList),
    issues,
    recipeCount: normalized.meals.length,
    title: normalized.week.title,
    weekEnd: weekEndText,
    weekStart: weekStartText,
  };
}
