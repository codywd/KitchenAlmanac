type IngredientRow = {
  item: string;
  quantity?: string;
};

export type SavedRecipeFormData = {
  active: boolean;
  batchPrepNote: string | null;
  budgetFit: boolean;
  costEstimateCents: number | null;
  cuisine: string | null;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  ingredients: IngredientRow[];
  kidAdaptations: string | null;
  kidFriendly: boolean;
  methodSteps: string[];
  name: string;
  noFishSafe: boolean;
  prepTimeActiveMinutes: number | null;
  prepTimeTotalMinutes: number | null;
  servings: number;
  sourceUrl: string | null;
  tags: string[];
  updatedByUserId: string;
  validationNotes: string | null;
  weeknightTimeSafe: boolean;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);

  return value || null;
}

function checkbox(formData: FormData, key: string) {
  const value = formData.get(key);

  return value === "on" || value === "true";
}

function parseOptionalInteger(value: string, label: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }

  return parsed;
}

function parseServings(value: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Servings must be a positive whole number.");
  }

  return parsed;
}

function parseCostEstimateCents(value: string) {
  if (!value) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error("Cost estimate must be a positive dollar amount.");
  }

  return Math.round(Number(value) * 100);
}

function normalizedTag(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseTags(value: string) {
  const tags = value
    .split(/[,\n]/)
    .map(normalizedTag)
    .filter(Boolean);

  return [...new Set(tags)];
}

function parseSourceUrl(value: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    throw new Error("Source URL must be a valid URL.");
  }
}

function isIngredientRecord(value: unknown): value is IngredientRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as {
    item?: unknown;
    name?: unknown;
    quantity?: unknown;
  };
  const name = typeof record.item === "string" ? record.item : record.name;

  return typeof name === "string" && Boolean(name.trim());
}

function parseIngredientsJson(value: string) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("Ingredients must be a JSON array.");
    }

    return parsed.map((item) => {
      if (!isIngredientRecord(item)) {
        throw new Error("Each ingredient needs an item or name.");
      }

      const record = item as {
        item?: unknown;
        name?: unknown;
        quantity?: unknown;
      };
      const name =
        typeof record.item === "string"
          ? record.item
          : typeof record.name === "string"
            ? record.name
            : "";
      const quantity = typeof record.quantity === "string" ? record.quantity.trim() : "";

      return {
        item: name.trim(),
        ...(quantity ? { quantity } : {}),
      };
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Ingredients must be valid JSON.");
    }

    throw error;
  }
}

function parseIngredientRows(formData: FormData) {
  const names = formData.getAll("ingredientItem").map((value) => String(value));
  const quantities = formData
    .getAll("ingredientQuantity")
    .map((value) => String(value));

  if (!names.length) {
    return parseIngredientsJson(text(formData, "ingredientsJson"));
  }

  return names
    .map((name, index) => {
      const item = name.trim();
      const quantity = quantities[index]?.trim() ?? "";

      if (!item) {
        return null;
      }

      return {
        item,
        ...(quantity ? { quantity } : {}),
      };
    })
    .filter((ingredient): ingredient is IngredientRow => Boolean(ingredient));
}

export function tagsFromSourceRecipe(sourceRecipe: unknown) {
  if (!sourceRecipe || typeof sourceRecipe !== "object" || Array.isArray(sourceRecipe)) {
    return [];
  }

  const tags = (sourceRecipe as { tags?: unknown }).tags;

  return Array.isArray(tags) ? parseTags(tags.map(String).join("\n")) : [];
}

export function parseSavedRecipeFormData(
  formData: FormData,
  userId: string,
): SavedRecipeFormData {
  const name = text(formData, "name");

  if (!name) {
    throw new Error("Name the recipe before saving it.");
  }

  const ingredients = parseIngredientRows(formData);

  if (!ingredients.length) {
    throw new Error("Add at least one ingredient.");
  }

  return {
    active: checkbox(formData, "active"),
    batchPrepNote: optionalText(formData, "batchPrepNote"),
    budgetFit: checkbox(formData, "budgetFit"),
    costEstimateCents: parseCostEstimateCents(text(formData, "costEstimateDollars")),
    cuisine: optionalText(formData, "cuisine"),
    diabetesFriendly: checkbox(formData, "diabetesFriendly"),
    heartHealthy: checkbox(formData, "heartHealthy"),
    ingredients,
    kidAdaptations: optionalText(formData, "kidAdaptations"),
    kidFriendly: checkbox(formData, "kidFriendly"),
    methodSteps: text(formData, "methodStepsText")
      .split(/\r?\n/)
      .map((step) => step.trim())
      .filter(Boolean),
    name,
    noFishSafe: checkbox(formData, "noFishSafe"),
    prepTimeActiveMinutes: parseOptionalInteger(
      text(formData, "prepTimeActiveMinutes"),
      "Active prep time",
    ),
    prepTimeTotalMinutes: parseOptionalInteger(
      text(formData, "prepTimeTotalMinutes"),
      "Total prep time",
    ),
    servings: parseServings(text(formData, "servings")),
    sourceUrl: parseSourceUrl(text(formData, "sourceUrl")),
    tags: parseTags(text(formData, "tagsText")),
    updatedByUserId: userId,
    validationNotes: optionalText(formData, "validationNotes"),
    weeknightTimeSafe: checkbox(formData, "weeknightTimeSafe"),
  };
}
