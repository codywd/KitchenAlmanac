import {
  Archive,
  ArchiveRestore,
  BookOpen,
  CalendarDays,
  Clock,
  DollarSign,
} from "lucide-react";
import Link from "next/link";

import { archiveSavedRecipeAction } from "@/app/recipe-actions";
import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { SavedRecipeEditForm } from "@/components/saved-recipe-edit-form";
import { Section } from "@/components/section";
import { formatMoney, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

function flagList(recipe: {
  budgetFit: boolean;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  kidFriendly: boolean;
  noFishSafe: boolean;
  weeknightTimeSafe: boolean;
}) {
  return [
    recipe.diabetesFriendly ? "diabetes" : null,
    recipe.heartHealthy ? "heart" : null,
    recipe.noFishSafe ? "no fish" : null,
    recipe.kidFriendly ? "kid" : null,
    recipe.budgetFit ? "budget" : null,
    recipe.weeknightTimeSafe ? "weeknight" : null,
  ].filter(Boolean);
}

export default async function RecipesPage() {
  const context = await requireFamilyContext("/recipes");
  const canManage = canManagePlans(context.role);
  const recipes = await getDb().savedRecipe.findMany({
    include: {
      createdBy: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: [
      {
        active: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
    where: {
      familyId: context.family.id,
    },
  });
  const activeRecipes = recipes.filter((recipe) => recipe.active);
  const archivedRecipes = recipes.filter((recipe) => !recipe.active);

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            <div className="flex flex-wrap gap-2">
              <Link className="ka-button-secondary gap-2" href="/meal-memory">
                Meal memory
                <BookOpen size={16} />
              </Link>
              {canManage ? (
                <Link className="ka-button gap-2" href="/planner">
                  Planner
                  <CalendarDays size={16} />
                </Link>
              ) : null}
            </div>
          }
          eyebrow="Recipe library"
          title="Household Cookbook"
        >
          Browse the family recipes that worked well enough to reuse in future
          plans and review swaps.
        </PageIntro>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="ka-panel border border-[var(--line)]">
            <BookOpen className="text-[var(--herb)]" size={20} />
            <div className="mt-3 text-3xl font-black text-[var(--ink)]">
              {activeRecipes.length}
            </div>
            <div className="text-sm font-semibold text-[var(--muted-ink)]">
              active recipes
            </div>
          </div>
          <div className="ka-panel border border-[var(--line)]">
            <Archive className="text-[var(--tomato)]" size={20} />
            <div className="mt-3 text-3xl font-black text-[var(--ink)]">
              {archivedRecipes.length}
            </div>
            <div className="text-sm font-semibold text-[var(--muted-ink)]">
              archived
            </div>
          </div>
          <div className="ka-panel border border-[var(--line)]">
            <DollarSign className="text-[var(--herb)]" size={20} />
            <div className="mt-3 text-3xl font-black text-[var(--ink)]">
              {formatMoney(
                activeRecipes.reduce(
                  (total, recipe) => total + (recipe.costEstimateCents ?? 0),
                  0,
                ),
              )}
            </div>
            <div className="text-sm font-semibold text-[var(--muted-ink)]">
              active estimate total
            </div>
          </div>
        </div>

        <Section title="Saved Recipes">
          {recipes.length ? (
            <div className="grid gap-4">
              {recipes.map((recipe) => {
                const flags = flagList(recipe);

                return (
                  <article
                    className="ka-card p-5"
                    key={recipe.id}
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className="ka-status-mark"
                            data-tone={recipe.active ? "fresh" : "muted"}
                          >
                            {recipe.active ? "active" : "archived"}
                          </span>
                          {recipe.sourceMealDate ? (
                            <span className="ka-status-mark" data-tone="muted">
                              saved from {toDateOnly(recipe.sourceMealDate)}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="recipe-display mt-3 text-3xl font-semibold leading-tight text-[var(--ink)]">
                          {recipe.name}
                        </h2>
                        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                          {recipe.cuisine ?? "Cuisine TBD"} /{" "}
                          {recipe.servings} servings /{" "}
                          {formatMoney(recipe.costEstimateCents)}
                          {typeof recipe.prepTimeTotalMinutes === "number" ? (
                            <>
                              {" "}
                              / <Clock className="inline" size={14} />{" "}
                              {recipe.prepTimeTotalMinutes} min
                            </>
                          ) : null}
                        </p>
                        {flags.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {flags.map((flag) => (
                              <span className="ka-status-mark" key={flag}>
                                {flag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {recipe.feedbackReason ? (
                          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                            {recipe.feedbackReason}
                          </p>
                        ) : null}
                      </div>
                      {canManage ? (
                        <form action={archiveSavedRecipeAction}>
                          <input name="recipeId" type="hidden" value={recipe.id} />
                          <input
                            name="active"
                            type="hidden"
                            value={recipe.active ? "false" : "true"}
                          />
                          <button className="ka-button-secondary gap-2">
                            {recipe.active ? (
                              <Archive size={15} />
                            ) : (
                              <ArchiveRestore size={15} />
                            )}
                            {recipe.active ? "Archive" : "Restore"}
                          </button>
                        </form>
                      ) : null}
                    </div>

                    {canManage ? (
                      <details className="mt-5 border-t border-[var(--line)] pt-4">
                        <summary className="cursor-pointer text-sm font-black text-[var(--herb-dark)]">
                          Edit recipe
                        </summary>
                        <div className="mt-4">
                          <SavedRecipeEditForm recipe={recipe} />
                        </div>
                      </details>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ka-panel border-dashed p-6 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
              Save a worked-well meal from meal memory or week closeout to start
              the household cookbook.
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
