import type {
  MealFeedbackStatus,
  MealOutcomeStatus as PrismaMealOutcomeStatus,
} from "@prisma/client";

import { formatMoney } from "./dates";
import type { MealVoteWithUser } from "./votes";

export type MealOutcomeStatus = PrismaMealOutcomeStatus;

export type WeekCloseoutMeal = {
  actualCostCents: number | null;
  costEstimateCents: number | null;
  cuisine: string | null;
  feedbackReason: string | null;
  feedbackStatus: MealFeedbackStatus;
  feedbackTweaks: string | null;
  id: string;
  leftoverNotes: string | null;
  name: string;
  outcomeNotes: string | null;
  outcomeStatus: MealOutcomeStatus;
  votes: MealVoteWithUser[];
};

export type WeekCloseoutInput = {
  budgetTargetCents: number | null;
  days: Array<{
    date: string;
    meal: WeekCloseoutMeal | null;
  }>;
  weekId: string;
  weekStart: string;
};

export type WeekCloseoutDay = {
  actualCostCents: number | null;
  costDeltaCents: number | null;
  costSummary: string;
  cuisine: string | null;
  date: string;
  feedbackReason: string | null;
  feedbackStatus: MealFeedbackStatus | null;
  feedbackTweaks: string | null;
  leftoverNotes: string | null;
  mealId: string | null;
  mealName: string | null;
  needsCloseout: boolean;
  outcomeLabel: string;
  outcomeNotes: string | null;
  outcomeStatus: MealOutcomeStatus | "NO_MEAL";
  voteComments: Array<{
    comment: string;
    label: string;
    vote: MealVoteWithUser["vote"];
  }>;
  voteCounts: Record<MealVoteWithUser["vote"], number>;
};

export type WeekCloseout = {
  days: WeekCloseoutDay[];
  stats: {
    actualCostCents: number | null;
    actualCostDeltaCents: number | null;
    closedDinners: number;
    cookedDinners: number;
    estimatedClosedCostCents: number | null;
    estimatedCostCents: number | null;
    leftoverDinners: number;
    missingDinners: number;
    plannedDinners: number;
    replacedDinners: number;
    skippedDinners: number;
    unclosedDinners: number;
  };
  weekId: string;
  weekStart: string;
};

const outcomeLabels: Record<MealOutcomeStatus | "NO_MEAL", string> = {
  COOKED: "Cooked",
  LEFTOVERS: "Leftovers",
  NO_MEAL: "No dinner",
  PLANNED: "Needs closeout",
  REPLACED: "Replaced",
  SKIPPED: "Skipped",
};

export function normalizeMealOutcomeStatus(status: string): MealOutcomeStatus {
  const normalized = status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "ALREADY_LEFTOVERS") {
    return "LEFTOVERS";
  }

  if (
    normalized === "PLANNED" ||
    normalized === "COOKED" ||
    normalized === "SKIPPED" ||
    normalized === "REPLACED" ||
    normalized === "LEFTOVERS"
  ) {
    return normalized;
  }

  throw new Error(`Unsupported meal outcome status: ${status}`);
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

function sumNullable(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => typeof value === "number");

  return numbers.length ? numbers.reduce((total, value) => total + value, 0) : null;
}

function costSummary({
  actualCostCents,
  costEstimateCents,
}: {
  actualCostCents: number | null;
  costEstimateCents: number | null;
}) {
  if (typeof actualCostCents === "number" && typeof costEstimateCents === "number") {
    const delta = actualCostCents - costEstimateCents;

    return `${formatMoney(actualCostCents)} actual (${delta >= 0 ? "+" : ""}${formatMoney(
      delta,
    )} vs estimate)`;
  }

  if (typeof actualCostCents === "number") {
    return `${formatMoney(actualCostCents)} actual`;
  }

  return `${formatMoney(costEstimateCents)} estimated`;
}

export function buildWeekCloseout(input: WeekCloseoutInput): WeekCloseout {
  const days = input.days.map((day): WeekCloseoutDay => {
    if (!day.meal) {
      return {
        actualCostCents: null,
        costDeltaCents: null,
        costSummary: "No dinner stored",
        cuisine: null,
        date: day.date,
        feedbackReason: null,
        feedbackStatus: null,
        feedbackTweaks: null,
        leftoverNotes: null,
        mealId: null,
        mealName: null,
        needsCloseout: false,
        outcomeLabel: outcomeLabels.NO_MEAL,
        outcomeNotes: null,
        outcomeStatus: "NO_MEAL",
        voteComments: [],
        voteCounts: {
          NO: 0,
          OKAY: 0,
          WANT: 0,
        },
      };
    }

    const costDeltaCents =
      typeof day.meal.actualCostCents === "number" &&
      typeof day.meal.costEstimateCents === "number"
        ? day.meal.actualCostCents - day.meal.costEstimateCents
        : null;

    return {
      actualCostCents: day.meal.actualCostCents,
      costDeltaCents,
      costSummary: costSummary(day.meal),
      cuisine: day.meal.cuisine,
      date: day.date,
      feedbackReason: day.meal.feedbackReason,
      feedbackStatus: day.meal.feedbackStatus,
      feedbackTweaks: day.meal.feedbackTweaks,
      leftoverNotes: day.meal.leftoverNotes,
      mealId: day.meal.id,
      mealName: day.meal.name,
      needsCloseout: day.meal.outcomeStatus === "PLANNED",
      outcomeLabel: outcomeLabels[day.meal.outcomeStatus],
      outcomeNotes: day.meal.outcomeNotes,
      outcomeStatus: day.meal.outcomeStatus,
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

  const meals = input.days.flatMap((day) => (day.meal ? [day.meal] : []));
  const closedMeals = meals.filter((meal) => meal.outcomeStatus !== "PLANNED");
  const actualCostCents = sumNullable(closedMeals.map((meal) => meal.actualCostCents));
  const estimatedClosedCostCents = sumNullable(
    closedMeals
      .filter((meal) => typeof meal.actualCostCents === "number")
      .map((meal) => meal.costEstimateCents),
  );
  const estimatedCostCents = sumNullable(meals.map((meal) => meal.costEstimateCents));

  return {
    days,
    stats: {
      actualCostCents,
      actualCostDeltaCents:
        typeof actualCostCents === "number" &&
        typeof estimatedClosedCostCents === "number"
          ? actualCostCents - estimatedClosedCostCents
          : null,
      closedDinners: closedMeals.length,
      cookedDinners: meals.filter((meal) => meal.outcomeStatus === "COOKED").length,
      estimatedClosedCostCents,
      estimatedCostCents,
      leftoverDinners: meals.filter((meal) => meal.outcomeStatus === "LEFTOVERS").length,
      missingDinners: input.days.filter((day) => !day.meal).length,
      plannedDinners: meals.length,
      replacedDinners: meals.filter((meal) => meal.outcomeStatus === "REPLACED").length,
      skippedDinners: meals.filter((meal) => meal.outcomeStatus === "SKIPPED").length,
      unclosedDinners: meals.filter((meal) => meal.outcomeStatus === "PLANNED").length,
    },
    weekId: input.weekId,
    weekStart: input.weekStart,
  };
}
