export type SavedRecipeActiveFilter = "all" | "false" | "true";

export type SavedRecipeFlagFilter =
  | "budgetFit"
  | "diabetesFriendly"
  | "heartHealthy"
  | "kidFriendly"
  | "noFishSafe"
  | "weeknightTimeSafe";

export type SavedRecipeFilterInput = {
  active?: SavedRecipeActiveFilter;
  cuisines?: string[];
  flags?: SavedRecipeFlagFilter[];
  query?: string;
  tags?: string[];
};

export type SavedRecipeFilterable = Record<SavedRecipeFlagFilter, boolean> & {
  active: boolean;
  cuisine: string | null;
  ingredients: unknown;
  name: string;
  tags: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizedList(values?: string[]) {
  return (values ?? []).map(normalize).filter(Boolean);
}

function ingredientText(ingredients: unknown) {
  if (!Array.isArray(ingredients)) {
    return "";
  }

  return ingredients
    .map((ingredient) => {
      if (!ingredient || typeof ingredient !== "object") {
        return "";
      }

      const record = ingredient as {
        item?: unknown;
        name?: unknown;
        quantity?: unknown;
      };

      return [record.item, record.name, record.quantity]
        .filter((value): value is string => typeof value === "string")
        .join(" ");
    })
    .join(" ");
}

function matchesQuery(recipe: SavedRecipeFilterable, query?: string) {
  const normalizedQuery = normalize(query ?? "");

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    recipe.name,
    recipe.cuisine ?? "",
    recipe.tags.join(" "),
    ingredientText(recipe.ingredients),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function filterSavedRecipes<T extends SavedRecipeFilterable>(
  recipes: T[],
  filters: SavedRecipeFilterInput,
) {
  const active = filters.active ?? "true";
  const tags = normalizedList(filters.tags);
  const cuisines = normalizedList(filters.cuisines);
  const flags = filters.flags ?? [];

  return recipes.filter((recipe) => {
    if (active !== "all" && recipe.active !== (active === "true")) {
      return false;
    }

    if (!matchesQuery(recipe, filters.query)) {
      return false;
    }

    if (
      tags.length &&
      !tags.every((tag) => recipe.tags.map(normalize).includes(tag))
    ) {
      return false;
    }

    if (
      cuisines.length &&
      !cuisines.includes(normalize(recipe.cuisine ?? ""))
    ) {
      return false;
    }

    return flags.every((flag) => recipe[flag]);
  });
}

export function savedRecipeFilterOptions(recipes: SavedRecipeFilterable[]) {
  return {
    cuisines: [
      ...new Set(
        recipes
          .map((recipe) => recipe.cuisine?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ].toSorted((left, right) => left.localeCompare(right)),
    tags: [
      ...new Set(
        recipes.flatMap((recipe) =>
          recipe.tags.map((tag) => tag.trim()).filter(Boolean),
        ),
      ),
    ].toSorted((left, right) => left.localeCompare(right)),
  };
}
