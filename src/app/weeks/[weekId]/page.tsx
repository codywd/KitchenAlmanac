import { ChefHat, ClipboardCheck, ClipboardList, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { recordFeedbackAction } from "@/app/meal-actions";
import { AppShell } from "@/components/app-shell";
import { MealVotePanel } from "@/components/meal-vote-panel";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import { addDays, formatDisplayDate, formatMoney, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

type IngredientListItem = {
  item: string;
  pantryItem: boolean | undefined;
  preparation: string | undefined;
  quantity: string;
  substitutes: string[];
};

function asIngredientList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const ingredients = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const ingredient = item as { item?: unknown; quantity?: unknown };
      const namedIngredient = item as {
        name?: unknown;
        pantryItem?: unknown;
        preparation?: unknown;
        substitutes?: unknown;
      };

      return {
        item: String(ingredient.item ?? namedIngredient.name ?? ""),
        pantryItem:
          typeof namedIngredient.pantryItem === "boolean"
            ? namedIngredient.pantryItem
            : undefined,
        preparation:
          typeof namedIngredient.preparation === "string"
            ? namedIngredient.preparation
            : undefined,
        quantity: ingredient.quantity ? String(ingredient.quantity) : "",
        substitutes: Array.isArray(namedIngredient.substitutes)
          ? namedIngredient.substitutes.map(String)
          : [],
      };
    })
    .filter((item): item is IngredientListItem => Boolean(item?.item));

  return ingredients;
}

function sourceRecipeDetails(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const recipe = value as {
    difficulty?: unknown;
    equipment?: unknown;
    health_adjustment?: unknown;
    nutrition_estimate_per_serving?: unknown;
    serving_notes?: unknown;
    tags?: unknown;
    why_this_works?: unknown;
  };
  const health =
    recipe.health_adjustment && typeof recipe.health_adjustment === "object"
      ? (recipe.health_adjustment as {
          changes?: unknown;
          plate_build?: unknown;
          why_it_helps?: unknown;
        })
      : null;

  return {
    difficulty:
      typeof recipe.difficulty === "string" ? recipe.difficulty : undefined,
    equipment: Array.isArray(recipe.equipment) ? recipe.equipment.map(String) : [],
    healthChanges: Array.isArray(health?.changes)
      ? health.changes.map(String)
      : [],
    nutrition:
      recipe.nutrition_estimate_per_serving &&
      typeof recipe.nutrition_estimate_per_serving === "object"
        ? (recipe.nutrition_estimate_per_serving as Record<string, unknown>)
        : null,
    plateBuild:
      typeof health?.plate_build === "string" ? health.plate_build : undefined,
    servingNotes: Array.isArray(recipe.serving_notes)
      ? recipe.serving_notes.map(String)
      : [],
    tags: Array.isArray(recipe.tags) ? recipe.tags.map(String) : [],
    whyThisWorks:
      typeof recipe.why_this_works === "string" ? recipe.why_this_works : undefined,
  };
}

export default async function WeekDetailPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;
  const context = await requireFamilyContext(`/weeks/${weekId}`);
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
      groceryList: true,
    },
    where: {
      familyId: context.family.id,
      id: weekId,
    },
  });

  if (!week) {
    notFound();
  }

  const daySlots = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week.weekStart, index);
    const day = week.days.find(
      (candidate) => toDateOnly(candidate.date) === toDateOnly(date),
    );

    return { date, day };
  });

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
      <PageIntro
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="ka-button-secondary gap-2" href={`/weeks/${week.id}/review`}>
              Review & swap
              <ClipboardCheck size={16} />
            </Link>
            <Link className="ka-button-secondary gap-2" href={`/weeks/${week.id}/shopping`}>
              Shopping
              <ShoppingCart size={16} />
            </Link>
            <Link className="ka-button-secondary gap-2" href={`/weeks/${week.id}/closeout`}>
              Closeout
              <ClipboardList size={16} />
            </Link>
          </div>
        }
        eyebrow="Week detail"
        title={week.title ?? `Week of ${toDateOnly(week.weekStart)}`}
      >
          Budget target: {formatMoney(week.budgetTargetCents)} · API id:{" "}
          <code className="font-bold text-[var(--ink)]">{week.id}</code>
      </PageIntro>

      <div className="grid gap-4">
        {daySlots.map(({ date, day }) => {
          const meal = day?.dinner;

          return (
            <Section key={toDateOnly(date)} title={formatDisplayDate(date)}>
              {meal ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div>
                    <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
                      <div>
                        <h2 className="recipe-display text-3xl font-semibold leading-tight text-[var(--ink)]">{meal.name}</h2>
                        <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
                          {meal.cuisine ?? "Cuisine TBD"} / {meal.servings} servings /{" "}
                          {formatMoney(meal.costEstimateCents)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="ka-button gap-2"
                          href={`/cook/${meal.id}`}
                        >
                          <ChefHat size={16} />
                          Cook
                        </Link>
                        <div className="ka-status-mark" data-tone="warm">
                          {meal.prepTimeActiveMinutes ?? "?"} min active /{" "}
                          {meal.prepTimeTotalMinutes ?? "?"} min total
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["Diabetes", meal.diabetesFriendly],
                        ["Heart", meal.heartHealthy],
                        ["No fish", meal.noFishSafe],
                        ["Kid", meal.kidFriendly],
                        ["Budget", meal.budgetFit],
                        ["Weeknight", meal.weeknightTimeSafe],
                      ].map(([label, enabled]) => (
                        <div
                          className={`border-l-2 px-3 py-2 text-sm font-bold ${
                            enabled
                              ? "border-[var(--herb)] bg-[rgba(66,102,63,0.1)] text-[var(--herb-dark)]"
                              : "border-[var(--line)] bg-[rgba(255,253,245,0.34)] text-[var(--muted-ink)]"
                          }`}
                          key={String(label)}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                    {meal.validationNotes ? (
                      <p className="mt-4 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                        {meal.validationNotes}
                      </p>
                    ) : null}
                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div>
                        <h3 className="ka-kicker">Ingredients</h3>
                        <ul className="mt-3 space-y-2 text-sm font-semibold text-[var(--ink)]">
                          {asIngredientList(meal.ingredients).map((ingredient) => (
                            <li key={`${ingredient.item}-${ingredient.quantity}`}>
                              {ingredient.item}
                              {ingredient.quantity ? (
                                <span className="text-[var(--muted-ink)]">
                                  {" "}
                                  · {ingredient.quantity}
                                </span>
                              ) : null}
                              {ingredient.preparation ? (
                                <div className="mt-1 text-xs text-[var(--muted-ink)]">
                                  {ingredient.preparation}
                                </div>
                              ) : null}
                              {ingredient.pantryItem ? (
                                <span className="ka-status-mark mt-1" data-tone="muted">
                                  pantry
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="ka-kicker">Method</h3>
                        <ol className="mt-3 space-y-2 text-sm font-semibold leading-6 text-[var(--ink)]">
                          {meal.methodSteps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                    {meal.kidAdaptations || meal.batchPrepNote ? (
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {meal.kidAdaptations ? (
                          <div className="ka-note text-sm leading-6">
                            <span className="font-black text-[var(--ink)]">Kids:</span>{" "}
                            {meal.kidAdaptations}
                          </div>
                        ) : null}
                        {meal.batchPrepNote ? (
                          <div className="ka-success text-sm leading-6">
                            <span className="font-black">Prep:</span>{" "}
                            {meal.batchPrepNote}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {sourceRecipeDetails(meal.sourceRecipe) ? (
                      <div className="ka-panel mt-5">
                        {(() => {
                          const details = sourceRecipeDetails(meal.sourceRecipe);

                          if (!details) {
                            return null;
                          }

                          return (
                            <div className="space-y-4">
                              <div className="flex flex-wrap gap-2">
                                {details.difficulty ? (
                                  <span className="ka-status-mark" data-tone="warm">
                                    {details.difficulty}
                                  </span>
                                ) : null}
                                {details.tags.map((tag) => (
                                  <span
                                    className="ka-status-mark"
                                    key={tag}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              {details.whyThisWorks ? (
                                <p className="text-sm font-semibold leading-6 text-[var(--ink)]">
                                  {details.whyThisWorks}
                                </p>
                              ) : null}
                              {details.plateBuild ? (
                                <p className="text-sm font-semibold leading-6 text-[var(--ink)]">
                                  <span className="font-black text-[var(--herb-dark)]">
                                    Cody plate:
                                  </span>{" "}
                                  {details.plateBuild}
                                </p>
                              ) : null}
                              {details.nutrition ? (
                                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                                  {Object.entries(details.nutrition).map(
                                    ([key, value]) => (
                                      <div
                                        className="bg-[rgba(255,253,245,0.6)] p-2"
                                        key={key}
                                      >
                                        <div className="text-xs font-bold text-[var(--muted-ink)]">
                                          {key.replaceAll("_", " ")}
                                        </div>
                                        <div className="mt-1 text-sm font-black text-[var(--ink)]">
                                          {String(value)}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-4">
                    <MealVotePanel
                      currentUserId={context.user.id}
                      mealId={meal.id}
                      votes={meal.votes}
                    />
                  {canManage ? (
                  <form action={recordFeedbackAction} className="ka-panel">
                    <input name="mealId" type="hidden" value={meal.id} />
                    <input name="weekId" type="hidden" value={week.id} />
                    <h3 className="recipe-display text-2xl font-semibold text-[var(--ink)]">Feedback</h3>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
                      Current: {meal.feedbackStatus.replaceAll("_", " ").toLowerCase()}
                    </p>
                    <label className="mt-4 block">
                      <span className="ka-label">Status</span>
                      <select
                        className="ka-select mt-1"
                        defaultValue={meal.feedbackStatus}
                        name="status"
                      >
                        <option value="LIKED">Liked</option>
                        <option value="WORKED_WITH_TWEAKS">Worked with tweaks</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="PLANNED">Planned</option>
                      </select>
                    </label>
                    <label className="mt-3 block">
                      <span className="ka-label">Reason</span>
                      <textarea
                        className="ka-textarea mt-1 min-h-20 text-sm"
                        defaultValue={meal.feedbackReason ?? ""}
                        name="reason"
                      />
                    </label>
                    <label className="mt-3 block">
                      <span className="ka-label">Tweaks</span>
                      <textarea
                        className="ka-textarea mt-1 min-h-20 text-sm"
                        defaultValue={meal.feedbackTweaks ?? ""}
                        name="tweaks"
                      />
                    </label>
                    <label className="mt-3 block">
                      <span className="ka-label">Pattern to avoid</span>
                      <input
                        className="ka-field mt-1 text-sm"
                        name="patternToAvoid"
                        placeholder="For rejected meals"
                      />
                    </label>
                    <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--muted-ink)]">
                      <input name="createRejectedPattern" type="checkbox" />
                      Add to rejected meals
                    </label>
                    <button className="ka-button mt-4 w-full">
                      Save feedback
                    </button>
                  </form>
                  ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-[var(--muted-ink)]">
                  No dinner stored for this day. Use the API endpoint for this week and
                  date to add one.
                </p>
              )}
            </Section>
          );
        })}
      </div>

      <Section title="Grocery List">
        <p className="mb-4 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
          After review-board swaps, compare and refresh this list from{" "}
          <Link className="font-black text-[var(--herb-dark)]" href={`/ingredients?weekId=${week.id}`}>
            grocery reconciliation
          </Link>
          , then shop it from{" "}
          <Link className="font-black text-[var(--herb-dark)]" href={`/weeks/${week.id}/shopping`}>
            shared shopping
          </Link>
          .
        </p>
        {week.groceryList ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(week.groceryList.sections as { name: string; items: { item: string; quantity?: string }[] }[]).map(
              (section) => (
                <div className="ka-panel" key={section.name}>
                  <h3 className="recipe-display text-2xl font-semibold text-[var(--ink)]">{section.name}</h3>
                  <ul className="mt-3 space-y-2 text-sm font-semibold text-[var(--ink)]">
                    {section.items.map((item) => (
                      <li key={`${section.name}-${item.item}`}>
                        {item.item}
                        {item.quantity ? (
                          <span className="text-[var(--muted-ink)]"> · {item.quantity}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-sm font-semibold text-[var(--muted-ink)]">
            No grocery list stored yet. External callers can write one with{" "}
            <code>POST /api/weeks/{week.id}/grocery-list</code>.
          </p>
        )}
      </Section>
      </div>
    </AppShell>
  );
}
