import type {
  FamilyRole,
  HouseholdDocumentKind,
  MealFeedbackStatus,
  MealOutcomeStatus,
  MealVoteValue,
} from "@prisma/client";

import {
  addDays,
  formatMoney,
  parseDateOnly,
  startOfMealPlanWeek,
  toDateOnly,
} from "./dates";
import { getDb } from "./db";
import { aggregateIngredientsForWeek } from "./ingredients";
import {
  savedRecipePlannerLine,
  savedRecipesForPlannerContext,
  type SavedRecipePlannerContext,
} from "./saved-recipes";
import { voteLabel } from "./votes";

export type PlanningBriefFamily = {
  id: string;
  name: string;
};

export type PlanningBriefQuery = {
  budgetTargetCents: number | null;
  weekStart: Date;
};

export type PlanningBriefFamilyMember = {
  email: string;
  name: string | null;
  role: FamilyRole;
};

export type PlanningBriefHouseholdDocument = {
  content: string;
  kind: HouseholdDocumentKind;
  title: string;
};

export type PlanningBriefRejectedMeal = {
  mealName: string;
  patternToAvoid: string;
  reason: string;
  rejectedAt: string;
};

export type PlanningBriefRecentVote = {
  comment: string | null;
  mealDate: string;
  mealName: string;
  updatedAt: string;
  vote: MealVoteValue;
  voterEmail: string;
  voterName: string | null;
  weekStart: string;
};

export type PlanningBriefRecentMeal = {
  actualCostCents: number | null;
  costEstimateCents: number | null;
  cuisine: string | null;
  date: string;
  feedbackReason: string | null;
  feedbackStatus: MealFeedbackStatus;
  feedbackTweaks: string | null;
  flags: string[];
  leftoverNotes: string | null;
  name: string;
  outcomeNotes: string | null;
  outcomeStatus: MealOutcomeStatus;
  weekStart: string;
};

export type PlanningBriefGrocerySection = {
  itemCount: number;
  items: string[];
  name: string;
};

export type PlanningBriefGrocerySummary = {
  notes: string | null;
  sections: PlanningBriefGrocerySection[];
  weekStart: string;
};

export type PlanningBriefIngredientSignal = {
  displayTotal: string;
  mealNames: string[];
  name: string;
  pantryItem: boolean;
};

export type PlanningBriefPantryStaple = {
  canonicalName: string;
  displayName: string;
  id: string;
};

export type PlanningBriefContext = {
  activeRejectedMeals: PlanningBriefRejectedMeal[];
  familyMembers: PlanningBriefFamilyMember[];
  householdDocuments: PlanningBriefHouseholdDocument[];
  pantryStaples: PlanningBriefPantryStaple[];
  savedRecipes: SavedRecipePlannerContext[];
  recentGrocerySummaries: PlanningBriefGrocerySummary[];
  recentIngredientSignals: PlanningBriefIngredientSignal[];
  recentMeals: PlanningBriefRecentMeal[];
  recentVotes: PlanningBriefRecentVote[];
};

export type PlanningBriefInput = {
  budgetTargetCents: number | null;
  context: PlanningBriefContext;
  family: PlanningBriefFamily;
  generatedAt: string;
  weekStart: Date;
};

export type PlanningBriefResponse = {
  briefMarkdown: string;
  context: PlanningBriefContext;
  family: PlanningBriefFamily;
  generatedAt: string;
  weekEnd: string;
  weekStart: string;
};

type SearchParamReader = {
  get(name: string): string | null;
};

type RecentWeek = {
  days: Array<{
    date: Date;
    dinner: {
      budgetFit: boolean;
      actualCostCents: number | null;
      costEstimateCents: number | null;
      cuisine: string | null;
      diabetesFriendly: boolean;
      feedbackReason: string | null;
      feedbackStatus: MealFeedbackStatus;
      feedbackTweaks: string | null;
      heartHealthy: boolean;
      ingredients: unknown;
      kidFriendly: boolean;
      leftoverNotes: string | null;
      name: string;
      noFishSafe: boolean;
      outcomeNotes: string | null;
      outcomeStatus: MealOutcomeStatus;
      weeknightTimeSafe: boolean;
    } | null;
  }>;
  groceryList: {
    notes: string | null;
    sections: unknown;
  } | null;
  weekStart: Date;
};

export function defaultPlanningWeekStart(now = new Date()) {
  return addDays(startOfMealPlanWeek(now), 7);
}

function parseStrictDateOnly(value: string, paramName: string) {
  try {
    return parseDateOnly(value);
  } catch {
    throw new Error(`${paramName} must be a valid YYYY-MM-DD date.`);
  }
}

export function parsePlanningBriefQuery(
  searchParams: SearchParamReader,
  {
    defaultBudgetTargetCents = null,
    now = new Date(),
  }: {
    defaultBudgetTargetCents?: number | null;
    now?: Date;
  } = {},
): PlanningBriefQuery {
  const rawWeekStart = searchParams.get("weekStart")?.trim();
  const rawBudget = searchParams.get("budgetTargetCents")?.trim();
  const weekStart = rawWeekStart
    ? parseStrictDateOnly(rawWeekStart, "weekStart")
    : defaultPlanningWeekStart(now);
  let budgetTargetCents = defaultBudgetTargetCents;

  if (rawBudget) {
    const parsed = Number(rawBudget);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error("budgetTargetCents must be a positive integer.");
    }

    budgetTargetCents = parsed;
  }

  return {
    budgetTargetCents,
    weekStart,
  };
}

export async function getLatestFamilyBudgetTargetCents(familyId: string) {
  const latestWeek = await getDb().week.findFirst({
    orderBy: {
      weekStart: "desc",
    },
    select: {
      budgetTargetCents: true,
    },
    where: {
      budgetTargetCents: {
        not: null,
      },
      familyId,
    },
  });

  return latestWeek?.budgetTargetCents ?? null;
}

function flagsForMeal(meal: {
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

function itemLabel(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    item?: unknown;
    name?: unknown;
    quantity?: unknown;
  };
  const name = typeof record.item === "string" ? record.item : record.name;

  if (typeof name !== "string" || !name.trim()) {
    return null;
  }

  return typeof record.quantity === "string" && record.quantity.trim()
    ? `${record.quantity.trim()} ${name.trim()}`
    : name.trim();
}

function grocerySummariesFromWeeks(weeks: RecentWeek[]) {
  return weeks
    .filter((week) => week.groceryList)
    .map((week) => {
      const sections = Array.isArray(week.groceryList?.sections)
        ? week.groceryList.sections
        : [];

      return {
        notes: week.groceryList?.notes ?? null,
        sections: sections
          .map((section) => {
            if (!section || typeof section !== "object") {
              return null;
            }

            const record = section as {
              items?: unknown;
              name?: unknown;
            };
            const items = Array.isArray(record.items)
              ? record.items.map(itemLabel).filter((item): item is string => Boolean(item))
              : [];

            return {
              itemCount: items.length,
              items: items.slice(0, 12),
              name: typeof record.name === "string" && record.name.trim()
                ? record.name.trim()
                : "Other",
            };
          })
          .filter((section): section is PlanningBriefGrocerySection => Boolean(section)),
        weekStart: toDateOnly(week.weekStart),
      };
    });
}

function recentMealsFromWeeks(weeks: RecentWeek[]) {
  return weeks
    .flatMap((week) =>
      week.days
        .filter((day) => day.dinner)
        .map((day) => {
          const meal = day.dinner!;

          return {
            actualCostCents: meal.actualCostCents,
            costEstimateCents: meal.costEstimateCents,
            cuisine: meal.cuisine,
            date: toDateOnly(day.date),
            feedbackReason: meal.feedbackReason,
            feedbackStatus: meal.feedbackStatus,
            feedbackTweaks: meal.feedbackTweaks,
            flags: flagsForMeal(meal),
            leftoverNotes: meal.leftoverNotes,
            name: meal.name,
            outcomeNotes: meal.outcomeNotes,
            outcomeStatus: meal.outcomeStatus,
            weekStart: toDateOnly(week.weekStart),
          };
        }),
    )
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 42);
}

function ingredientSignalsFromWeeks(weeks: RecentWeek[]) {
  return aggregateIngredientsForWeek(
    weeks.flatMap((week) =>
      week.days
        .filter((day) => day.dinner)
        .map((day) => ({
          date: day.date,
          ingredients: day.dinner!.ingredients,
          mealName: day.dinner!.name,
        })),
    ),
  )
    .map((ingredient) => ({
      displayTotal: ingredient.displayTotal,
      mealNames: Array.from(
        new Set(ingredient.days.map((day) => day.mealName)),
      ).slice(0, 6),
      name: ingredient.canonicalName,
      pantryItem: ingredient.pantryItem,
    }))
    .sort((left, right) => {
      const countDifference = right.mealNames.length - left.mealNames.length;

      return countDifference || left.name.localeCompare(right.name);
    })
    .slice(0, 24);
}

export async function loadPlanningBriefContext({
  familyId,
  weekStart,
}: {
  familyId: string;
  weekStart: Date;
}): Promise<PlanningBriefContext> {
  const [
    householdDocuments,
    familyMembers,
    activeRejectedMeals,
    pantryStaples,
    savedRecipes,
    recentVotes,
    recentWeeks,
  ] = await Promise.all([
    getDb().householdDocument.findMany({
      orderBy: {
        kind: "asc",
      },
      select: {
        content: true,
        kind: true,
        title: true,
      },
      where: {
        familyId,
      },
    }),
    getDb().familyMember.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      where: {
        familyId,
      },
    }),
    getDb().rejectedMeal.findMany({
      orderBy: {
        rejectedAt: "desc",
      },
      select: {
        mealName: true,
        patternToAvoid: true,
        reason: true,
        rejectedAt: true,
      },
      take: 50,
      where: {
        active: true,
        familyId,
      },
    }),
    getDb().pantryStaple.findMany({
      orderBy: {
        displayName: "asc",
      },
      select: {
        canonicalName: true,
        displayName: true,
        id: true,
      },
      where: {
        active: true,
        familyId,
      },
    }),
    getDb().savedRecipe.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
      where: {
        active: true,
        familyId,
      },
    }),
    getDb().mealVote.findMany({
      include: {
        meal: {
          select: {
            dayPlan: {
              select: {
                date: true,
                week: {
                  select: {
                    weekStart: true,
                  },
                },
              },
            },
            name: true,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
      where: {
        meal: {
          dayPlan: {
            week: {
              familyId,
            },
          },
        },
      },
    }),
    getDb().week.findMany({
      include: {
        days: {
          include: {
            dinner: true,
          },
          orderBy: {
            date: "asc",
          },
        },
        groceryList: true,
      },
      orderBy: {
        weekStart: "desc",
      },
      take: 8,
      where: {
        familyId,
        weekStart: {
          lt: weekStart,
        },
      },
    }),
  ]);

  return {
    activeRejectedMeals: activeRejectedMeals.map((meal) => ({
      mealName: meal.mealName,
      patternToAvoid: meal.patternToAvoid,
      reason: meal.reason,
      rejectedAt: meal.rejectedAt.toISOString(),
    })),
    familyMembers: familyMembers.map((member) => ({
      email: member.user.email,
      name: member.user.name,
      role: member.role,
    })),
    householdDocuments,
    pantryStaples,
    savedRecipes: savedRecipesForPlannerContext(savedRecipes),
    recentGrocerySummaries: grocerySummariesFromWeeks(recentWeeks),
    recentIngredientSignals: ingredientSignalsFromWeeks(recentWeeks),
    recentMeals: recentMealsFromWeeks(recentWeeks),
    recentVotes: recentVotes.map((vote) => ({
      comment: vote.comment,
      mealDate: toDateOnly(vote.meal.dayPlan.date),
      mealName: vote.meal.name,
      updatedAt: vote.updatedAt.toISOString(),
      vote: vote.vote,
      voterEmail: vote.user.email,
      voterName: vote.user.name,
      weekStart: toDateOnly(vote.meal.dayPlan.week.weekStart),
    })),
  };
}

function personLabel(person: { email: string; name: string | null }) {
  return person.name?.trim() || person.email;
}

function listSection<T>(
  title: string,
  items: T[],
  formatter: (item: T, index: number) => string,
  emptyText: string,
) {
  return [
    `## ${title}`,
    items.length
      ? items.map((item, index) => formatter(item, index)).join("\n")
      : emptyText,
  ].join("\n\n");
}

function documentSection(documents: PlanningBriefHouseholdDocument[]) {
  if (!documents.length) {
    return ["## Household Guidance", "No household guidance documents are stored yet."].join(
      "\n\n",
    );
  }

  return [
    "## Household Guidance",
    documents
      .map(
        (document) =>
          `### ${document.title}\nKind: ${document.kind}\n\n${document.content.trim()}`,
      )
      .join("\n\n"),
  ].join("\n\n");
}

function outputContract() {
  return [
    "## Requested Output",
    "Create one dinner plan for each date in the target week. Return only JSON that this app can import at `/import` or `POST /api/import/meal-plan`.",
    "Required top-level shape:",
    "```json",
    JSON.stringify(
      {
        input_summary: {
          assumptions: [],
          budget_target_usd: 0,
          constraints: [],
          family_size: 0,
        },
        recipes: [
          {
            day: "Monday",
            dinner_title: "Recipe name",
            estimated_cost_usd: 0,
            ingredients: [],
            instructions: [],
            servings: 7,
            tags: [],
            time: {
              prep_minutes: 0,
              total_minutes: 0,
            },
            why_this_works: "",
          },
        ],
        schema_version: "1.0",
        shopping_list: {},
        weekly_overview: {
          budget_status: "",
          coordination_strategy: [],
          estimated_total_grocery_cost_usd: 0,
          prep_ahead: [],
          theme: "",
        },
      },
      null,
      2,
    ),
    "```",
  ].join("\n\n");
}

export function buildPlanningBriefMarkdown(input: PlanningBriefInput) {
  const weekStart = toDateOnly(input.weekStart);
  const weekEnd = toDateOnly(addDays(input.weekStart, 6));
  const budget = input.budgetTargetCents
    ? formatMoney(input.budgetTargetCents)
    : "No explicit target supplied";

  return [
    "# Meal Planning Brief",
    `Family: ${input.family.name}`,
    `Target week: ${weekStart} through ${weekEnd}`,
    `Budget target: ${budget}`,
    `Generated at: ${input.generatedAt}`,
    "Use this source material directly. Favor meals that fit the household guidance, respond to votes and comments, avoid active rejections, and do not repeat recent meals too closely.",
    outputContract(),
    listSection(
      "Family Members",
      input.context.familyMembers,
      (member) => `- ${personLabel(member)} (${member.role.toLowerCase()})`,
      "No family members were found.",
    ),
    documentSection(input.context.householdDocuments),
    listSection(
      "Active Rejected Meals And Patterns",
      input.context.activeRejectedMeals,
      (meal) =>
        `- ${meal.mealName}: ${meal.reason}. Avoid pattern: ${meal.patternToAvoid}.`,
      "No active rejected meals are stored.",
    ),
    listSection(
      "Pantry Staples",
      input.context.pantryStaples,
      (staple) => `- ${staple.displayName} (${staple.canonicalName})`,
      "No pantry staples are stored.",
    ),
    listSection(
      "Household Cookbook / Proven Recipes",
      input.context.savedRecipes,
      (recipe) => savedRecipePlannerLine(recipe),
      "No saved recipes are stored.",
    ),
    listSection(
      "Recent Vote Signals",
      input.context.recentVotes,
      (vote) =>
        `- ${vote.mealName} (${vote.mealDate}): ${personLabel({
          email: vote.voterEmail,
          name: vote.voterName,
        })} voted ${voteLabel(vote.vote)}${
          vote.comment ? ` - "${vote.comment}"` : ""
        }.`,
      "No recent meal votes are stored.",
    ),
    listSection(
      "Recent Meal History",
      input.context.recentMeals,
      (meal) =>
        `- ${meal.date}: ${meal.name}${
          meal.cuisine ? ` (${meal.cuisine})` : ""
        }; cost ${formatMoney(meal.costEstimateCents)}; feedback ${meal.feedbackStatus
          .replaceAll("_", " ")
          .toLowerCase()}${
          meal.feedbackReason ? `; reason: ${meal.feedbackReason}` : ""
        }${meal.feedbackTweaks ? `; tweaks: ${meal.feedbackTweaks}` : ""}${
          `; outcome ${meal.outcomeStatus.replaceAll("_", " ").toLowerCase()}`
        }${
          typeof meal.actualCostCents === "number"
            ? `; actual ${formatMoney(meal.actualCostCents)}`
            : ""
        }${
          meal.outcomeNotes ? `; outcome notes: ${meal.outcomeNotes}` : ""
        }${
          meal.leftoverNotes ? `; leftovers: ${meal.leftoverNotes}` : ""
        }${
          meal.flags.length ? `; flags: ${meal.flags.join(", ")}` : ""
        }.`,
      "No recent meal history is stored.",
    ),
    listSection(
      "Recent Grocery Lists",
      input.context.recentGrocerySummaries,
      (grocery) =>
        `- Week ${grocery.weekStart}${
          grocery.notes ? ` (${grocery.notes})` : ""
        }: ${grocery.sections
          .map((section) => `${section.name} ${section.itemCount} items`)
          .join("; ") || "no section details"}.`,
      "No recent grocery lists are stored.",
    ),
    listSection(
      "Recent Ingredient Signals",
      input.context.recentIngredientSignals,
      (ingredient) =>
        `- ${ingredient.name}: ${ingredient.displayTotal}; used by ${ingredient.mealNames.join(
          ", ",
        ) || "recent meals"}${ingredient.pantryItem ? "; usually pantry" : ""}.`,
      "No recent ingredient history is available.",
    ),
  ].join("\n\n");
}

export function buildPlanningBriefResponse(
  input: PlanningBriefInput,
): PlanningBriefResponse {
  return {
    briefMarkdown: buildPlanningBriefMarkdown(input),
    context: input.context,
    family: input.family,
    generatedAt: input.generatedAt,
    weekEnd: toDateOnly(addDays(input.weekStart, 6)),
    weekStart: toDateOnly(input.weekStart),
  };
}
