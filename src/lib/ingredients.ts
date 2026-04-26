export type IngredientSource = {
  date: Date;
  ingredients: unknown;
  mealName: string;
};

export type AggregatedIngredientDay = {
  date: Date;
  displayQuantity: string;
  mealName: string;
};

export type AggregatedIngredient = {
  canonicalName: string;
  days: AggregatedIngredientDay[];
  displayTotal: string;
  pantryItem: boolean;
};

type ParsedIngredient = {
  canonicalName: string;
  date: Date;
  displayQuantity: string;
  mealName: string;
  pantryItem: boolean;
  unit?: string;
  value?: number;
};

const nameReplacements: Array<[RegExp, string]> = [
  [/\b(yellow|white|red|medium|large|small)\s+onions?\b/g, "onion"],
  [/\b(mini\s+sweet\s+)?bell\s+peppers?\b/g, "bell pepper"],
  [/\b(low[-\s]?sodium|no[-\s]?salt[-\s]?added)\b/g, ""],
  [/\bboneless\s+skinless\s+chicken\s+breasts?\b/g, "chicken breast"],
  [/\b93\s*(percent|%)\s+lean\s+ground\s+turkey\b/g, "ground turkey"],
  [/\bwhole\s+wheat\s+tortillas?.*$/g, "whole wheat tortillas"],
  [/\bromaine\s+(hearts?|lettuce)\b/g, "romaine"],
  [/\bfresh\s+ginger\b/g, "ginger"],
  [/\bfresh\s+cilantro\b/g, "cilantro"],
];

const irregularPlurals = new Map([
  ["apples", "apple"],
  ["avocados", "avocado"],
  ["beans", "beans"],
  ["carrots", "carrot"],
  ["cucumbers", "cucumber"],
  ["limes", "lime"],
  ["onions", "onion"],
  ["peppers", "pepper"],
  ["potatoes", "potato"],
  ["tomatoes", "tomato"],
  ["tortillas", "tortillas"],
]);

function stripPunctuation(value: string) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/[,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIngredientName(value: string) {
  let normalized = stripPunctuation(value.toLowerCase());

  for (const [pattern, replacement] of nameReplacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/\b(reduced[-\s]?fat|part[-\s]?skim|plain|nonfat|low[-\s]?fat)\b/g, "")
    .replace(/\b(frozen|fresh|large|medium|small|whole|prepared|cooked)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (irregularPlurals.has(normalized)) {
    return irregularPlurals.get(normalized)!;
  }

  if (normalized.endsWith("ies")) {
    return `${normalized.slice(0, -3)}y`;
  }

  if (
    normalized.endsWith("s") &&
    !normalized.endsWith("ss") &&
    !normalized.endsWith("beans") &&
    !normalized.endsWith("tortillas")
  ) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function numberFromText(value: string) {
  const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)\b/);

  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }

  const fraction = value.match(/^(\d+)\/(\d+)\b/);

  if (fraction) {
    return Number(fraction[1]) / Number(fraction[2]);
  }

  const decimal = value.match(/^(\d+(?:\.\d+)?)\b/);

  return decimal ? Number(decimal[1]) : undefined;
}

function normalizeUnit(value: string, amountText: string) {
  return value
    .slice(amountText.length)
    .trim()
    .replace(/\b(cans|can)\b/g, "can")
    .replace(/\b(cups)\b/g, "cup")
    .replace(/\b(pounds|lbs|lb)\b/g, "pound")
    .replace(/\b(ounces|oz)\b/g, "ounce")
    .replace(/\b(tablespoons|tbsp)\b/g, "tablespoon")
    .replace(/\b(teaspoons|tsp)\b/g, "teaspoon")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuantity(value?: string) {
  const displayQuantity = value?.trim() || "as needed";
  const amountMatch = displayQuantity.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/);
  const numericValue = numberFromText(displayQuantity);

  if (!amountMatch || numericValue === undefined || Number.isNaN(numericValue)) {
    return {
      displayQuantity,
    };
  }

  const unit = normalizeUnit(displayQuantity, amountMatch[0]);

  return {
    displayQuantity: [formatNumber(numericValue), unit].filter(Boolean).join(" "),
    unit,
    value: numericValue,
  };
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Number(value.toFixed(2))).replace(/\.0+$/, "");
}

function formatTotal(valuesByUnit: Map<string, number>, unmeasured: string[]) {
  const measured = Array.from(valuesByUnit.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([unit, value]) => [formatNumber(value), unit].filter(Boolean).join(" "));

  return [...measured, ...Array.from(new Set(unmeasured))].join(", ") || "as needed";
}

function extractIngredient(raw: unknown, source: IngredientSource): ParsedIngredient | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as {
    item?: unknown;
    name?: unknown;
    pantryItem?: unknown;
    pantry_item?: unknown;
    quantity?: unknown;
  };
  const name = typeof record.item === "string" ? record.item : record.name;

  if (typeof name !== "string" || !name.trim()) {
    return null;
  }

  const parsed = parseQuantity(
    typeof record.quantity === "string" ? record.quantity : undefined,
  );

  return {
    canonicalName: normalizeIngredientName(name),
    date: source.date,
    displayQuantity: parsed.displayQuantity,
    mealName: source.mealName,
    pantryItem:
      record.pantryItem === true || record.pantry_item === true ? true : false,
    unit: parsed.unit,
    value: parsed.value,
  };
}

export function aggregateIngredientsForWeek(
  sources: IngredientSource[],
): AggregatedIngredient[] {
  const grouped = new Map<
    string,
    {
      days: AggregatedIngredientDay[];
      pantryItem: boolean;
      totals: Map<string, number>;
      unmeasured: string[];
    }
  >();

  for (const source of sources) {
    const ingredients = Array.isArray(source.ingredients)
      ? source.ingredients
      : [];

    for (const rawIngredient of ingredients) {
      const ingredient = extractIngredient(rawIngredient, source);

      if (!ingredient) {
        continue;
      }

      const group =
        grouped.get(ingredient.canonicalName) ??
        {
          days: [],
          pantryItem: true,
          totals: new Map<string, number>(),
          unmeasured: [],
        };

      group.days.push({
        date: ingredient.date,
        displayQuantity: ingredient.displayQuantity,
        mealName: ingredient.mealName,
      });
      group.pantryItem = group.pantryItem && ingredient.pantryItem;

      if (typeof ingredient.value === "number" && ingredient.unit !== undefined) {
        group.totals.set(
          ingredient.unit,
          (group.totals.get(ingredient.unit) ?? 0) + ingredient.value,
        );
      } else {
        group.unmeasured.push(ingredient.displayQuantity);
      }

      grouped.set(ingredient.canonicalName, group);
    }
  }

  return Array.from(grouped.entries())
    .map(([canonicalName, group]) => ({
      canonicalName,
      days: group.days.sort(
        (left, right) => left.date.getTime() - right.date.getTime(),
      ),
      displayTotal: formatTotal(group.totals, group.unmeasured),
      pantryItem: group.pantryItem,
    }))
    .sort((left, right) => left.canonicalName.localeCompare(right.canonicalName));
}
