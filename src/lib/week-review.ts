import type { MealFeedbackStatus } from "@prisma/client";

import { formatMoney, toDateOnly } from "./dates";
import type { AggregatedIngredient } from "./ingredients";
import type { MealVoteWithUser } from "./votes";

export type WeekReviewIssue = {
  detail: string;
  severity: "info" | "warning";
  source:
    | "budget"
    | "flags"
    | "missing-meal"
    | "recent-repeat"
    | "rejected-pattern"
    | "vote";
  title: string;
};

export type WeekReviewMeal = {
  budgetFit: boolean;
  costEstimateCents: number | null;
  cuisine: string | null;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  id: string;
  kidFriendly: boolean;
  name: string;
  noFishSafe: boolean;
  searchText: string;
  servings: number;
  votes: MealVoteWithUser[];
  weeknightTimeSafe: boolean;
};

export type WeekReviewInput = {
  activeRejectedMeals: Array<{
    mealName: string;
    patternToAvoid: string;
    reason: string;
  }>;
  budgetTargetCents: number | null;
  days: Array<{
    date: string;
    meal: WeekReviewMeal | null;
  }>;
  ingredients: AggregatedIngredient[];
  recentMeals: Array<{
    date: string;
    feedbackStatus: MealFeedbackStatus;
    name: string;
  }>;
  weekId: string;
  weekStart: string;
};

export type WeekReviewIngredientUse = {
  canonicalName: string;
  displayQuantity: string;
  displayTotal: string;
  mealName: string;
  pantryItem: boolean;
};

export type WeekReviewDay = {
  costEstimateCents: number | null;
  cuisine: string | null;
  date: string;
  ingredientUses: WeekReviewIngredientUse[];
  issues: WeekReviewIssue[];
  mealId: string | null;
  mealName: string | null;
  servings: number | null;
  voteComments: Array<{
    comment: string;
    label: string;
    vote: MealVoteWithUser["vote"];
  }>;
  voteCounts: Record<MealVoteWithUser["vote"], number>;
};

export type WeekReview = {
  days: WeekReviewDay[];
  stats: {
    plannedDinners: number;
    totalCostEstimateCents: number | null;
    totalInfo: number;
    totalWarnings: number;
  };
  weekId: string;
  weekIssues: WeekReviewIssue[];
  weekStart: string;
};

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

function personLabel(vote: MealVoteWithUser) {
  return vote.user.name?.trim() || vote.user.email;
}

function voteCounts(votes: MealVoteWithUser[]) {
  const counts: Record<MealVoteWithUser["vote"], number> = {
    NO: 0,
    OKAY: 0,
    WANT: 0,
  };

  for (const vote of votes) {
    counts[vote.vote] += 1;
  }

  return counts;
}

function missingFlags(meal: WeekReviewMeal) {
  return [
    meal.diabetesFriendly ? null : "diabetes friendly",
    meal.heartHealthy ? null : "heart healthy",
    meal.noFishSafe ? null : "no fish safe",
    meal.kidFriendly ? null : "kid friendly",
    meal.budgetFit ? null : "budget fit",
    meal.weeknightTimeSafe ? null : "weeknight time safe",
  ].filter((flag): flag is string => Boolean(flag));
}

function ingredientUsesForDate(
  ingredients: AggregatedIngredient[],
  date: string,
): WeekReviewIngredientUse[] {
  return ingredients
    .flatMap((ingredient) =>
      ingredient.days
        .filter((day) => toDateOnly(day.date) === date)
        .map((day) => ({
          canonicalName: ingredient.canonicalName,
          displayQuantity: day.displayQuantity,
          displayTotal: ingredient.displayTotal,
          mealName: day.mealName,
          pantryItem: ingredient.pantryItem,
        })),
    )
    .sort((left, right) => left.canonicalName.localeCompare(right.canonicalName));
}

function issuesForMeal(input: WeekReviewInput, meal: WeekReviewMeal) {
  const issues: WeekReviewIssue[] = [];
  const counts = voteCounts(meal.votes);

  for (const rejected of input.activeRejectedMeals) {
    if (
      patternMatches(meal.name, rejected.mealName) ||
      patternMatches(meal.searchText, rejected.patternToAvoid)
    ) {
      issues.push({
        detail: `${rejected.reason} Avoid pattern: ${rejected.patternToAvoid}.`,
        severity: "warning",
        source: "rejected-pattern",
        title: "Active Rejection Match",
      });
    }
  }

  const repeatedMeal = input.recentMeals.find((recent) =>
    namesMatch(meal.name, recent.name),
  );

  if (repeatedMeal) {
    issues.push({
      detail: `Recently served on ${repeatedMeal.date} with feedback status ${repeatedMeal.feedbackStatus.toLowerCase()}.`,
      severity: "warning",
      source: "recent-repeat",
      title: "Recent Repeat",
    });
  }

  if (counts.NO > 0) {
    issues.push({
      detail: `${counts.NO} family member${counts.NO === 1 ? "" : "s"} voted No.`,
      severity: "warning",
      source: "vote",
      title: "Family No Vote",
    });
  }

  if (counts.WANT > 0) {
    issues.push({
      detail: `${counts.WANT} family member${counts.WANT === 1 ? "" : "s"} voted Want.`,
      severity: "info",
      source: "vote",
      title: "Family Want Vote",
    });
  }

  const missing = missingFlags(meal);

  if (missing.length > 0) {
    issues.push({
      detail: `Missing or unclaimed flags: ${missing.join(", ")}.`,
      severity: "warning",
      source: "flags",
      title: "Missing Planning Flags",
    });
  }

  return issues;
}

export function buildWeekReview(input: WeekReviewInput): WeekReview {
  const totalCost = input.days.reduce((total, day) => {
    if (typeof day.meal?.costEstimateCents !== "number") {
      return total;
    }

    return total + day.meal.costEstimateCents;
  }, 0);
  const weekIssues: WeekReviewIssue[] = [];

  if (
    typeof input.budgetTargetCents === "number" &&
    totalCost > input.budgetTargetCents
  ) {
    weekIssues.push({
      detail: `Estimated dinners are ${formatMoney(
        totalCost,
      )}, above the ${formatMoney(input.budgetTargetCents)} target.`,
      severity: "warning",
      source: "budget",
      title: "Over Budget Target",
    });
  }

  const days = input.days.map((day) => {
    if (!day.meal) {
      return {
        costEstimateCents: null,
        cuisine: null,
        date: day.date,
        ingredientUses: [],
        issues: [
          {
            detail: "No dinner is stored for this date.",
            severity: "warning" as const,
            source: "missing-meal" as const,
            title: "Missing Dinner",
          },
        ],
        mealId: null,
        mealName: null,
        servings: null,
        voteComments: [],
        voteCounts: {
          NO: 0,
          OKAY: 0,
          WANT: 0,
        },
      };
    }

    return {
      costEstimateCents: day.meal.costEstimateCents,
      cuisine: day.meal.cuisine,
      date: day.date,
      ingredientUses: ingredientUsesForDate(input.ingredients, day.date),
      issues: issuesForMeal(input, day.meal),
      mealId: day.meal.id,
      mealName: day.meal.name,
      servings: day.meal.servings,
      voteComments: day.meal.votes
        .filter((vote) => vote.comment?.trim())
        .map((vote) => ({
          comment: vote.comment!.trim(),
          label: personLabel(vote),
          vote: vote.vote,
        })),
      voteCounts: voteCounts(day.meal.votes),
    };
  });
  const allIssues = [...weekIssues, ...days.flatMap((day) => day.issues)];

  return {
    days,
    stats: {
      plannedDinners: input.days.filter((day) => day.meal).length,
      totalCostEstimateCents: totalCost || null,
      totalInfo: allIssues.filter((issue) => issue.severity === "info").length,
      totalWarnings: allIssues.filter((issue) => issue.severity === "warning")
        .length,
    },
    weekId: input.weekId,
    weekIssues,
    weekStart: input.weekStart,
  };
}
