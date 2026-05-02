import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Clock,
  DollarSign,
  Pencil,
  Plus,
  Search,
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
import {
  filterSavedRecipes,
  savedRecipeFilterOptions,
  type SavedRecipeActiveFilter,
  type SavedRecipeFlagFilter,
} from "@/lib/saved-recipe-filters";
import {
  firstRouteParam,
  routeParamValues,
  routeWithParams,
  type RouteParamValue,
  type RouteSearchParams,
} from "@/lib/routed-menu";

export const dynamic = "force-dynamic";

const flagFilters: Array<{ label: string; value: SavedRecipeFlagFilter }> = [
  { label: "Diabetes", value: "diabetesFriendly" },
  { label: "Heart", value: "heartHealthy" },
  { label: "No fish", value: "noFishSafe" },
  { label: "Kid", value: "kidFriendly" },
  { label: "Budget", value: "budgetFit" },
  { label: "Weeknight", value: "weeknightTimeSafe" },
];

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

type RecipesSearchParams = RouteSearchParams & {
  active?: RouteParamValue;
  cuisine?: RouteParamValue;
  flag?: RouteParamValue;
  menu?: RouteParamValue;
  q?: RouteParamValue;
  recipeId?: RouteParamValue;
  tag?: RouteParamValue;
};

function firstParam(value: RouteParamValue) {
  return firstRouteParam(value);
}

function arrayParam(value: RouteParamValue) {
  return routeParamValues(value);
}

function activeParam(value: string | string[] | undefined): SavedRecipeActiveFilter {
  const active = firstParam(value);

  return active === "all" || active === "false" ? active : "true";
}

function flagParams(value: string | string[] | undefined) {
  const allowed = new Set(flagFilters.map((flag) => flag.value));

  return arrayParam(value).filter((flag): flag is SavedRecipeFlagFilter =>
    allowed.has(flag as SavedRecipeFlagFilter),
  );
}

function recipeEditHref(params: RecipesSearchParams, recipeId: string) {
  return routeWithParams(
    "/recipes",
    params,
    {
      menu: "edit",
      recipeId,
    },
    `recipe-${recipeId}-edit`,
  );
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<RecipesSearchParams>;
}) {
  const context = await requireFamilyContext("/recipes");
  const params = await searchParams;
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
  const selectedFlags = flagParams(params.flag);
  const selectedMenu = firstParam(params.menu);
  const selectedRecipeId = firstParam(params.recipeId);
  const filters = {
    active: activeParam(params.active),
    cuisines: arrayParam(params.cuisine),
    flags: selectedFlags,
    query: firstParam(params.q) ?? "",
    tags: arrayParam(params.tag),
  };
  const filteredRecipes = filterSavedRecipes(recipes, filters);
  const filterOptions = savedRecipeFilterOptions(recipes);

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
                <Link className="ka-button gap-2" href="/recipes/new">
                  New recipe
                  <Plus size={16} />
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

        <Section title="Find Recipes">
          <form action="/recipes" className="ka-panel grid gap-3 border border-[var(--line)]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.7fr))_auto]">
              <label className="block">
                <span className="ka-label">Search</span>
                <input
                  className="ka-field mt-1"
                  defaultValue={filters.query}
                  name="q"
                  placeholder="Name, ingredient, tag"
                />
              </label>
              <label className="block">
                <span className="ka-label">Status</span>
                <select
                  className="ka-select mt-1 w-full"
                  defaultValue={filters.active}
                  name="active"
                >
                  <option value="true">Active</option>
                  <option value="false">Archived</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label className="block">
                <span className="ka-label">Tag</span>
                <select
                  className="ka-select mt-1 w-full"
                  defaultValue={filters.tags[0] ?? ""}
                  name="tag"
                >
                  <option value="">Any tag</option>
                  {filterOptions.tags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="ka-label">Cuisine</span>
                <select
                  className="ka-select mt-1 w-full"
                  defaultValue={filters.cuisines[0] ?? ""}
                  name="cuisine"
                >
                  <option value="">Any cuisine</option>
                  {filterOptions.cuisines.map((cuisine) => (
                    <option key={cuisine} value={cuisine}>
                      {cuisine}
                    </option>
                  ))}
                </select>
              </label>
              <button className="ka-button gap-2 self-end">
                <Search size={16} />
                Filter
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {flagFilters.map((flag) => (
                <label
                  className="flex min-h-10 items-center gap-2 border border-[var(--line)] bg-[rgba(255,253,245,0.42)] px-3 text-sm font-black text-[var(--ink)]"
                  key={flag.value}
                >
                  <input
                    className="size-4 accent-[var(--herb)]"
                    defaultChecked={filters.flags.includes(flag.value)}
                    name="flag"
                    type="checkbox"
                    value={flag.value}
                  />
                  {flag.label}
                </label>
              ))}
            </div>
          </form>
        </Section>

        <Section title="Saved Recipes">
          {filteredRecipes.length ? (
            <div className="grid gap-4">
              {filteredRecipes.map((recipe) => {
                const flags = flagList(recipe);
                const editPanelId = `recipe-${recipe.id}-edit`;
                const editIsSelected =
                  selectedMenu === "edit" && selectedRecipeId === recipe.id;

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
                        {recipe.tags.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {recipe.tags.map((tag) => (
                              <span
                                className="ka-status-mark"
                                data-tone="muted"
                                key={tag}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {recipe.sourceUrl ? (
                          <p className="mt-3 text-sm font-semibold leading-6">
                            <a
                              className="font-black text-[var(--herb-dark)]"
                              href={recipe.sourceUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Source recipe
                            </a>
                          </p>
                        ) : null}
                        {recipe.feedbackReason ? (
                          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                            {recipe.feedbackReason}
                          </p>
                        ) : null}
                      </div>
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="ka-button-secondary gap-2"
                            href={recipeEditHref(params, recipe.id)}
                          >
                            <Pencil size={15} />
                            Edit
                          </Link>
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
                        </div>
                      ) : null}
                    </div>

                    {canManage ? (
                      <details
                        className="mt-5 border-t border-[var(--line)] pt-4"
                        id={editPanelId}
                        open={editIsSelected}
                      >
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
              No recipes match the current filters.
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
