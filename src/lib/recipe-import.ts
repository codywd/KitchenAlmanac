import { z } from "zod";

import { addDays } from "./dates";

const stringArraySchema = z.array(z.string()).default([]);

const shoppingItemSchema = z
  .object({
    estimated_cost_usd: z.number().optional(),
    item: z.string().min(1),
    pantry_item: z.boolean().optional(),
    total_amount: z.union([z.number(), z.string()]).optional(),
    unit: z.string().optional(),
    used_in_recipes: z.array(z.string()).optional(),
  })
  .passthrough();

const ingredientImportSchema = z
  .object({
    amount: z.union([z.number(), z.string()]).optional(),
    name: z.string().min(1),
    optional: z.boolean().optional(),
    pantry_item: z.boolean().optional(),
    preparation: z.string().optional(),
    substitutes: z.array(z.string()).optional(),
    unit: z.string().optional(),
  })
  .passthrough();

const instructionImportSchema = z
  .object({
    heat: z.string().optional(),
    step: z.number().optional(),
    text: z.string().min(1),
    time_minutes: z.number().optional(),
  })
  .passthrough();

export const importedRecipeSchema = z
  .object({
    day: z.string().optional(),
    difficulty: z.string().optional(),
    dinner_title: z.string().min(1),
    equipment: z.array(z.string()).optional(),
    estimated_cost_usd: z.number().optional(),
    health_adjustment: z
      .object({
        changes: z.array(z.string()).optional(),
        for_person: z.string().optional(),
        plate_build: z.string().optional(),
        why_it_helps: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    ingredients: z.array(ingredientImportSchema).default([]),
    instructions: z.array(instructionImportSchema).default([]),
    kid_friendly_variation: z
      .object({
        notes: z.array(z.string()).optional(),
        serve_components_separately: z.boolean().optional(),
        strategy: z.string().optional(),
      })
      .passthrough()
      .optional(),
    leftovers: z
      .object({
        expected: z.boolean().optional(),
        reuse_ideas: z.array(z.string()).optional(),
        storage: z.string().optional(),
      })
      .passthrough()
      .optional(),
    nutrition_estimate_per_serving: z.record(z.string(), z.unknown()).optional(),
    servings: z.number().int().positive().optional(),
    tags: z.array(z.string()).optional(),
    time: z
      .object({
        cook_minutes: z.number().optional(),
        prep_minutes: z.number().optional(),
        total_minutes: z.number().optional(),
      })
      .passthrough()
      .optional(),
    why_this_works: z.string().optional(),
  })
  .passthrough();

export const importedMealPlanSchema = z
  .object({
    input_summary: z
      .object({
        assumptions: stringArraySchema.optional(),
        budget_target_usd: z.number().optional(),
        constraints: stringArraySchema.optional(),
        family_size: z.number().int().positive().optional(),
      })
      .passthrough()
      .optional(),
    recipes: z.array(importedRecipeSchema).min(1),
    schema_version: z.string().optional(),
    shopping_list: z.record(z.string(), z.array(shoppingItemSchema)).optional(),
    weekly_overview: z
      .object({
        budget_status: z.string().optional(),
        coordination_strategy: stringArraySchema.optional(),
        estimated_total_grocery_cost_usd: z.number().optional(),
        leftover_plan: stringArraySchema.optional(),
        pantry_staples_assumed: stringArraySchema.optional(),
        prep_ahead: z
          .array(
            z
              .object({
                instructions: z.string().optional(),
                item: z.string().optional(),
                minutes: z.number().optional(),
                when: z.string().optional(),
              })
              .passthrough(),
          )
          .optional(),
        theme: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type ImportedMealPlan = z.infer<typeof importedMealPlanSchema>;
type ImportedRecipe = z.infer<typeof importedRecipeSchema>;

const dayIndexes = new Map([
  ["sunday", 6],
  ["monday", 0],
  ["tuesday", 1],
  ["wednesday", 2],
  ["thursday", 3],
  ["friday", 4],
  ["saturday", 5],
]);

function toCents(value?: number) {
  return typeof value === "number" ? Math.round(value * 100) : undefined;
}

function sentenceList(items?: string[]) {
  return items?.filter(Boolean).map((item) => `- ${item}`).join("\n") ?? "";
}

function sectionTitle(value: string) {
  const words = value.replaceAll("_", " ").trim().toLowerCase();

  return words ? words[0].toUpperCase() + words.slice(1) : "Other";
}

function quantity(amount?: number | string, unit?: string) {
  const amountText = amount === undefined || amount === null ? "" : String(amount);
  const unitText = unit?.trim() ?? "";

  return [amountText, unitText].filter(Boolean).join(" ") || undefined;
}

function recipeIndex(recipe: ImportedRecipe, fallbackIndex: number) {
  const day = recipe.day?.trim().toLowerCase();

  return day ? dayIndexes.get(day) ?? fallbackIndex : fallbackIndex;
}

function containsFish(recipe: ImportedRecipe) {
  const text = JSON.stringify(recipe).toLowerCase();

  return /\b(fish|salmon|tuna|cod|tilapia|shrimp|shellfish|seafood)\b/.test(text);
}

function hasTag(recipe: ImportedRecipe, pattern: RegExp) {
  return recipe.tags?.some((tag) => pattern.test(tag.toLowerCase())) ?? false;
}

function validationNotes(recipe: ImportedRecipe) {
  const parts = [
    recipe.why_this_works,
    recipe.health_adjustment?.plate_build
      ? `Cody plate: ${recipe.health_adjustment.plate_build}`
      : undefined,
    recipe.health_adjustment?.why_it_helps?.length
      ? `Why it helps:\n${sentenceList(recipe.health_adjustment.why_it_helps)}`
      : undefined,
  ].filter(Boolean);

  return parts.join("\n\n") || undefined;
}

function kidAdaptations(recipe: ImportedRecipe) {
  const variation = recipe.kid_friendly_variation;

  if (!variation) {
    return undefined;
  }

  return [
    variation.strategy,
    variation.notes?.length ? sentenceList(variation.notes) : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function batchPrepNote(recipe: ImportedRecipe) {
  const leftovers = recipe.leftovers;

  if (!leftovers) {
    return undefined;
  }

  return [
    leftovers.storage ? `Storage: ${leftovers.storage}` : undefined,
    leftovers.reuse_ideas?.length
      ? `Reuse ideas:\n${sentenceList(leftovers.reuse_ideas)}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeImportedRecipe({
  budgetTargetUsd,
  constraints = [],
  date,
  familySize,
  recipe,
  withinBudget = false,
}: {
  budgetTargetUsd?: number;
  constraints?: string[];
  date: Date;
  familySize?: number;
  recipe: unknown;
  withinBudget?: boolean;
}) {
  const parsed = importedRecipeSchema.parse(recipe);
  const totalMinutes = parsed.time?.total_minutes;
  const hasHealthAdjustment = Boolean(parsed.health_adjustment);
  const noFishSafe =
    constraints.some((constraint) => constraint.toLowerCase().includes("no fish")) ||
    !containsFish(parsed);

  return {
    date,
    meal: {
      batchPrepNote: batchPrepNote(parsed),
      budgetFit:
        withinBudget ||
        hasTag(parsed, /budget/) ||
        (typeof parsed.estimated_cost_usd === "number" &&
          typeof budgetTargetUsd === "number" &&
          parsed.estimated_cost_usd <= budgetTargetUsd),
      costEstimateCents: toCents(parsed.estimated_cost_usd),
      cuisine: undefined,
      diabetesFriendly: hasHealthAdjustment,
      heartHealthy: hasHealthAdjustment,
      ingredients: parsed.ingredients.map((ingredient) => ({
        item: ingredient.name,
        optional: ingredient.optional ?? false,
        pantryItem: ingredient.pantry_item ?? false,
        preparation: ingredient.preparation,
        quantity: quantity(ingredient.amount, ingredient.unit),
        substitutes: ingredient.substitutes ?? [],
      })),
      kidAdaptations: kidAdaptations(parsed),
      kidFriendly:
        hasTag(parsed, /kid|family|build/) ||
        Boolean(parsed.kid_friendly_variation),
      methodSteps: parsed.instructions
        .toSorted((left, right) => (left.step ?? 0) - (right.step ?? 0))
        .map((instruction) => instruction.text),
      name: parsed.dinner_title,
      noFishSafe,
      prepTimeActiveMinutes: parsed.time?.prep_minutes,
      prepTimeTotalMinutes: totalMinutes,
      servings: parsed.servings ?? familySize ?? 7,
      sourceRecipe: parsed,
      validationNotes: validationNotes(parsed),
      weeknightTimeSafe:
        typeof totalMinutes === "number" ? totalMinutes <= 45 : false,
    },
  };
}

function weekNotes(plan: ImportedMealPlan) {
  const overview = plan.weekly_overview;
  const summary = plan.input_summary;

  return [
    overview?.theme ? `Theme: ${overview.theme}` : undefined,
    summary?.constraints?.length
      ? `Constraints:\n${sentenceList(summary.constraints)}`
      : undefined,
    summary?.assumptions?.length
      ? `Assumptions:\n${sentenceList(summary.assumptions)}`
      : undefined,
    overview?.coordination_strategy?.length
      ? `Coordination strategy:\n${sentenceList(overview.coordination_strategy)}`
      : undefined,
    overview?.prep_ahead?.length
      ? `Prep ahead:\n${overview.prep_ahead
          .map((item) =>
            [
              item.item ?? "Prep task",
              item.when ? `when: ${item.when}` : undefined,
              typeof item.minutes === "number" ? `${item.minutes} min` : undefined,
              item.instructions,
            ]
              .filter(Boolean)
              .join(" - "),
          )
          .join("\n")}`
      : undefined,
    overview?.leftover_plan?.length
      ? `Leftover plan:\n${sentenceList(overview.leftover_plan)}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function grocerySections(plan: ImportedMealPlan) {
  const shoppingList = plan.shopping_list;

  if (!shoppingList) {
    return undefined;
  }

  const sections = Object.entries(shoppingList)
    .map(([name, items]) => ({
      items: items.map((item) => ({
        estimatedCostUsd: item.estimated_cost_usd,
        item: item.item,
        pantryItem: item.pantry_item ?? false,
        quantity: quantity(item.total_amount, item.unit),
        usedInRecipes: item.used_in_recipes ?? [],
      })),
      name: sectionTitle(name),
    }))
    .filter((section) => section.items.length > 0);

  return sections.length ? sections : undefined;
}

export function normalizeImportedMealPlan({
  plan,
  weekStart,
}: {
  plan: unknown;
  weekStart: Date;
}) {
  const parsed = importedMealPlanSchema.parse(plan);
  const groceryList = grocerySections(parsed);
  const withinBudget =
    parsed.weekly_overview?.budget_status?.toLowerCase().includes("within") ??
    false;

  return {
    groceryList: groceryList
      ? {
          notes:
            typeof parsed.weekly_overview?.estimated_total_grocery_cost_usd ===
            "number"
              ? `Estimated total: $${parsed.weekly_overview.estimated_total_grocery_cost_usd.toFixed(
                  2,
                )}`
              : undefined,
          sections: groceryList,
        }
      : undefined,
    meals: parsed.recipes.map((recipe, index) => {
      const dayIndex = recipeIndex(recipe, index);
      const weeknight = dayIndex >= 0 && dayIndex <= 4;
      const normalizedRecipe = normalizeImportedRecipe({
        budgetTargetUsd: parsed.input_summary?.budget_target_usd,
        constraints: parsed.input_summary?.constraints,
        date: addDays(weekStart, dayIndex),
        familySize: parsed.input_summary?.family_size,
        recipe,
        withinBudget,
      });
      const totalMinutes = recipe.time?.total_minutes;

      return {
        date: normalizedRecipe.date,
        meal: {
          ...normalizedRecipe.meal,
          weeknightTimeSafe:
            typeof totalMinutes === "number"
              ? totalMinutes <= (weeknight ? 45 : 60)
              : false,
        },
      };
    }),
    week: {
      budgetTargetCents: toCents(parsed.input_summary?.budget_target_usd),
      notes: weekNotes(parsed),
      sourceImport: {
        ...parsed,
        importedRecipeCount: parsed.recipes.length,
      },
      title:
        parsed.weekly_overview?.theme ??
        `Imported meal plan ${parsed.schema_version ?? ""}`.trim(),
    },
  };
}
