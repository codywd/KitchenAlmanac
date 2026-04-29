import {
  AlertTriangle,
  ArrowRight,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  MessageSquareText,
  ShoppingBasket,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { MealVoteValue } from "@prisma/client";

import { voteMealAction } from "@/app/vote-actions";
import { AppShell } from "@/components/app-shell";
import { MealServingsForm } from "@/components/meal-servings-form";
import { MealSwapForm } from "@/components/meal-swap-form";
import { PageIntro } from "@/components/page-intro";
import { SavedRecipeSwapForm } from "@/components/saved-recipe-swap-form";
import { Section } from "@/components/section";
import { addDays, formatDisplayDate, formatMoney, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";
import { aggregateIngredientsForWeek } from "@/lib/ingredients";
import {
  buildWeekReview,
  type WeekReviewDay,
  type WeekReviewIssue,
} from "@/lib/week-review";
import {
  summarizeVotes,
  voteLabel,
  type MealVoteWithUser,
} from "@/lib/votes";

export const dynamic = "force-dynamic";

function issueTone(issue: WeekReviewIssue) {
  if (issue.severity === "warning") {
    return "border-[var(--tomato)] text-[var(--tomato-dark)]";
  }

  return "border-[var(--herb)] text-[var(--herb-dark)]";
}

function flagClass(active: boolean) {
  return active
    ? "border-[var(--herb)] bg-[rgba(66,102,63,0.1)] text-[var(--herb-dark)]"
    : "border-[var(--line)] bg-[rgba(255,253,245,0.34)] text-[var(--muted-ink)]";
}

function mealSearchText(meal: {
  ingredients: unknown;
  name: string;
  sourceRecipe: unknown;
}) {
  return [meal.name, JSON.stringify(meal.ingredients), JSON.stringify(meal.sourceRecipe)]
    .filter(Boolean)
    .join(" ");
}

function VoteReviewPanel({
  currentUserId,
  mealId,
  votes,
}: {
  currentUserId: string;
  mealId: string;
  votes: MealVoteWithUser[];
}) {
  const summary = summarizeVotes(votes, currentUserId);

  return (
    <div className="border-t border-[var(--line)] pt-4">
      <div className="flex flex-wrap gap-2">
        {(["WANT", "OKAY", "NO"] as MealVoteValue[]).map((value) => (
          <span
            className="border-l-2 border-[var(--line)] bg-[rgba(255,253,245,0.45)] px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]"
            key={value}
          >
            {voteLabel(value)} {summary.counts[value]}
          </span>
        ))}
      </div>
      <form action={voteMealAction} className="mt-4 space-y-3">
        <input name="mealId" type="hidden" value={mealId} />
        <div className="grid gap-2 sm:grid-cols-3">
          {(["WANT", "OKAY", "NO"] as MealVoteValue[]).map((value) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-2 border border-[var(--line)] bg-[rgba(255,253,245,0.42)] px-3 text-sm font-black text-[var(--ink)]"
              key={value}
            >
              <input
                className="size-4 accent-[var(--herb)]"
                defaultChecked={summary.currentUserVote?.vote === value}
                name="vote"
                required
                type="radio"
                value={value}
              />
              {voteLabel(value)}
            </label>
          ))}
        </div>
        <label className="block">
          <span className="ka-label">Comment</span>
          <textarea
            className="ka-textarea mt-1 min-h-20 text-sm"
            defaultValue={summary.currentUserVote?.comment ?? ""}
            name="comment"
            placeholder="Optional note for the review board."
          />
        </label>
        <button className="ka-button-secondary w-full">
          Save vote
        </button>
      </form>
    </div>
  );
}

function IssueList({ issues }: { issues: WeekReviewIssue[] }) {
  if (!issues.length) {
    return (
      <div className="ka-success text-sm font-semibold">
        No review warnings for this dinner.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div
          className={`border-l-2 bg-[rgba(255,253,245,0.45)] px-3 py-2 ${issueTone(
            issue,
          )}`}
          key={`${issue.title}-${issue.detail}`}
        >
          <div className="text-xs font-black uppercase tracking-[0.12em]">
            {issue.severity} / {issue.title}
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
            {issue.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

function IngredientUses({ day }: { day: WeekReviewDay }) {
  if (!day.ingredientUses.length) {
    return (
      <p className="text-sm font-semibold text-[var(--muted-ink)]">
        No ingredient rollup for this date yet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {day.ingredientUses.slice(0, 8).map((ingredient) => (
        <span
          className="ka-status-mark"
          data-tone={ingredient.pantryItem ? "muted" : undefined}
          key={`${day.date}-${ingredient.canonicalName}`}
        >
          {ingredient.canonicalName}: {ingredient.displayQuantity}
        </span>
      ))}
    </div>
  );
}

export default async function WeekReviewPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;
  const context = await requireFamilyContext(`/weeks/${weekId}/review`);
  const canManage = canManagePlans(context.role);
  const week = await getDb().week.findFirst({
    include: {
      days: {
        include: {
          dinner: {
            include: {
              votes: {
                include: {
                  user: {
                    select: {
                      email: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          date: "asc",
        },
      },
    },
    where: {
      familyId: context.family.id,
      id: weekId,
    },
  });

  if (!week) {
    notFound();
  }

  const [activeRejectedMeals, recentWeeks, savedRecipes] = await Promise.all([
    getDb().rejectedMeal.findMany({
      orderBy: {
        rejectedAt: "desc",
      },
      select: {
        mealName: true,
        patternToAvoid: true,
        reason: true,
      },
      take: 50,
      where: {
        active: true,
        familyId: context.family.id,
      },
    }),
    getDb().week.findMany({
      include: {
        days: {
          include: {
            dinner: {
              select: {
                feedbackStatus: true,
                name: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
        },
      },
      orderBy: {
        weekStart: "desc",
      },
      take: 8,
      where: {
        familyId: context.family.id,
        id: {
          not: week.id,
        },
        weekStart: {
          lt: week.weekStart,
        },
      },
    }),
    canManage
      ? getDb().savedRecipe.findMany({
          orderBy: {
            name: "asc",
          },
          select: {
            costEstimateCents: true,
            cuisine: true,
            id: true,
            name: true,
            prepTimeTotalMinutes: true,
          },
          where: {
            active: true,
            familyId: context.family.id,
          },
        })
      : Promise.resolve([]),
  ]);
  const daySlots = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week.weekStart, index);
    const day = week.days.find(
      (candidate) => toDateOnly(candidate.date) === toDateOnly(date),
    );

    return { date, day };
  });
  const ingredients = aggregateIngredientsForWeek(
    week.days
      .filter((day) => day.dinner)
      .map((day) => ({
        date: day.date,
        ingredients: day.dinner!.ingredients,
        mealName: day.dinner!.name,
      })),
  );
  const review = buildWeekReview({
    activeRejectedMeals,
    budgetTargetCents: week.budgetTargetCents,
    days: daySlots.map(({ date, day }) => {
      const meal = day?.dinner;

      return {
        date: toDateOnly(date),
        meal: meal
          ? {
              budgetFit: meal.budgetFit,
              costEstimateCents: meal.costEstimateCents,
              cuisine: meal.cuisine,
              diabetesFriendly: meal.diabetesFriendly,
              heartHealthy: meal.heartHealthy,
              id: meal.id,
              kidFriendly: meal.kidFriendly,
              name: meal.name,
              noFishSafe: meal.noFishSafe,
              searchText: mealSearchText(meal),
              servings: meal.servings,
              votes: meal.votes,
              weeknightTimeSafe: meal.weeknightTimeSafe,
            }
          : null,
      };
    }),
    ingredients,
    recentMeals: recentWeeks.flatMap((recentWeek) =>
      recentWeek.days
        .filter((day) => day.dinner)
        .map((day) => ({
          date: toDateOnly(day.date),
          feedbackStatus: day.dinner!.feedbackStatus,
          name: day.dinner!.name,
        })),
    ),
    weekId: week.id,
    weekStart: toDateOnly(week.weekStart),
  });

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            <div className="flex flex-wrap gap-2">
              <Link className="ka-button-secondary gap-2" href={`/weeks/${week.id}`}>
                Week detail
                <ArrowRight size={16} />
              </Link>
              <Link
                className="ka-button-secondary gap-2"
                href={`/ingredients?weekId=${week.id}`}
              >
                Ingredients
                <ShoppingBasket size={16} />
              </Link>
              <Link
                className="ka-button-secondary gap-2"
                href={`/weeks/${week.id}/shopping`}
              >
                Shopping
                <ShoppingCart size={16} />
              </Link>
              <Link
                className="ka-button-secondary gap-2"
                href={`/weeks/${week.id}/closeout`}
              >
                Closeout
                <ClipboardList size={16} />
              </Link>
            </div>
          }
          eyebrow="Week review"
          title={week.title ?? `Week of ${toDateOnly(week.weekStart)}`}
        >
          Review family votes, planning warnings, and ingredient impact before the
          week starts. After swaps, use{" "}
          <Link className="font-black text-[var(--herb-dark)]" href={`/ingredients?weekId=${week.id}`}>
            grocery reconciliation
          </Link>{" "}
          to refresh the stored list.
        </PageIntro>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="ka-panel border border-[var(--line)]">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
              Planned dinners
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--ink)]">
              {review.stats.plannedDinners}/7
            </div>
          </div>
          <div className="ka-panel border border-[var(--line)]">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
              Dinner cost
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--ink)]">
              {formatMoney(review.stats.totalCostEstimateCents)}
            </div>
            <p className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
              Target {formatMoney(week.budgetTargetCents)}
            </p>
          </div>
          <div className="ka-panel border border-[var(--line)]">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
              Warnings
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--ink)]">
              {review.stats.totalWarnings}
            </div>
          </div>
          <div className="ka-panel border border-[var(--line)]">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
              Helpful signals
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--ink)]">
              {review.stats.totalInfo}
            </div>
          </div>
        </div>

        {review.weekIssues.length ? (
          <Section title="Week-Level Signals">
            <IssueList issues={review.weekIssues} />
          </Section>
        ) : null}

        <Section title="Daily Review">
          <div className="grid gap-4">
            {review.days.map((day) => {
              const slot = daySlots.find(
                (candidate) => toDateOnly(candidate.date) === day.date,
              );
              const meal = slot?.day?.dinner;

              return (
                <section
                  className="border border-[var(--line)] bg-[rgba(255,253,245,0.42)] p-4"
                  key={day.date}
                >
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div>
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-black text-[var(--herb-dark)]">
                            <ClipboardCheck size={17} />
                            <span>{formatDisplayDate(new Date(`${day.date}T00:00:00.000Z`))}</span>
                          </div>
                          <h2 className="recipe-display mt-2 text-3xl font-semibold leading-tight text-[var(--ink)]">
                            {day.mealName ?? "No dinner planned"}
                          </h2>
                          <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
                            {day.cuisine ?? "Cuisine TBD"} /{" "}
                            {day.servings ? `${day.servings} servings` : "servings TBD"} /{" "}
                            {formatMoney(day.costEstimateCents)}
                          </p>
                          {canManage && meal ? (
                            <MealServingsForm
                              className="mt-3 max-w-sm"
                              mealId={meal.id}
                              servings={meal.servings}
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {meal ? (
                            <Link
                              className="ka-button-secondary gap-2"
                              href={`/cook/${meal.id}`}
                            >
                              <ChefHat size={15} />
                              Cook
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      {meal ? (
                        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            ["Diabetes", meal.diabetesFriendly],
                            ["Heart", meal.heartHealthy],
                            ["No fish", meal.noFishSafe],
                            ["Kid", meal.kidFriendly],
                            ["Budget", meal.budgetFit],
                            ["Weeknight", meal.weeknightTimeSafe],
                          ].map(([label, enabled]) => (
                            <div
                              className={`border-l-2 px-3 py-2 text-sm font-bold ${flagClass(
                                Boolean(enabled),
                              )}`}
                              key={String(label)}
                            >
                              {label}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-5 space-y-4">
                        <IssueList issues={day.issues} />
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                            <ShoppingBasket size={14} />
                            Ingredient impact
                          </div>
                          <IngredientUses day={day} />
                        </div>
                      </div>
                    </div>

                    <aside className="space-y-4 border-t border-[var(--line)] pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                      {meal ? (
                        <>
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                            <MessageSquareText size={14} />
                            Family vote
                          </div>
                          <VoteReviewPanel
                            currentUserId={context.user.id}
                            mealId={meal.id}
                            votes={meal.votes}
                          />
                          {day.voteComments.length ? (
                            <div className="divide-y divide-[var(--line)]">
                              {day.voteComments.map((comment) => (
                                <div
                                  className="py-3 first:pt-0 last:pb-0"
                                  key={`${day.date}-${comment.label}-${comment.comment}`}
                                >
                                  <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--herb-dark)]">
                                    {comment.label} / {voteLabel(comment.vote)}
                                  </div>
                                  <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                                    {comment.comment}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="ka-note flex gap-2 text-sm font-semibold leading-6">
                          <AlertTriangle className="mt-1 shrink-0" size={16} />
                          Add a single recipe JSON to fill this dinner slot.
                        </div>
                      )}

                      {canManage ? (
                        <>
                          <SavedRecipeSwapForm
                            date={day.date}
                            recipes={savedRecipes}
                            weekId={week.id}
                          />
                          <MealSwapForm date={day.date} weekId={week.id} />
                        </>
                      ) : null}
                    </aside>
                  </div>
                </section>
              );
            })}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
