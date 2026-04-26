import {
  normalizeIngredientName,
  type AggregatedIngredient,
} from "./ingredients";

export type GroceryListItem = {
  item: string;
  pantryItem?: boolean;
  pantry_item?: boolean;
  quantity?: string;
  usedInRecipes?: string[];
  used_in_recipes?: string[];
};

export type GroceryListSection = {
  items: GroceryListItem[];
  name: string;
};

export type GroceryPantryStaple = {
  active: boolean;
  canonicalName: string;
  displayName: string;
};

export type GroceryReconciliationItem = {
  canonicalName: string;
  item: string;
  quantity?: string;
};

export type GroceryQuantityChange = {
  canonicalName: string;
  item: string;
  nextQuantity?: string;
  previousItem: string;
  previousQuantity?: string;
};

export type GroceryReconciliation = {
  added: GroceryReconciliationItem[];
  derivedItemCount: number;
  hasChanges: boolean;
  quantityChanged: GroceryQuantityChange[];
  removed: GroceryReconciliationItem[];
  storedItemCount: number;
  unchangedCount: number;
};

type GroceryMapItem = GroceryReconciliationItem & {
  sectionName: string;
};

export const refreshedGroceryListNotes =
  "Refreshed from current planned dinners.";

function uniqueMealNames(ingredient: AggregatedIngredient) {
  return Array.from(new Set(ingredient.days.map((day) => day.mealName)));
}

function groceryItemFromIngredient(ingredient: AggregatedIngredient) {
  return {
    item: ingredient.canonicalName,
    pantryItem: ingredient.pantryItem,
    quantity: ingredient.displayTotal,
    usedInRecipes: uniqueMealNames(ingredient),
  };
}

export function buildGrocerySectionsFromIngredients(
  ingredients: AggregatedIngredient[],
  pantryStaples: GroceryPantryStaple[] = [],
): GroceryListSection[] {
  const activePantryNames = new Set(
    pantryStaples
      .filter((staple) => staple.active)
      .map((staple) => staple.canonicalName),
  );
  const toBuy = ingredients
    .filter(
      (ingredient) =>
        !ingredient.pantryItem && !activePantryNames.has(ingredient.canonicalName),
    )
    .map(groceryItemFromIngredient);
  const pantry = ingredients
    .filter(
      (ingredient) =>
        ingredient.pantryItem || activePantryNames.has(ingredient.canonicalName),
    )
    .map((ingredient) => ({
      ...groceryItemFromIngredient(ingredient),
      pantryItem: true,
    }));
  const sections: GroceryListSection[] = [];

  if (toBuy.length) {
    sections.push({
      items: toBuy,
      name: "To buy",
    });
  }

  if (pantry.length) {
    sections.push({
      items: pantry,
      name: "Pantry / on hand",
    });
  }

  return sections;
}

export function countGroceryItems(sections: GroceryListSection[]) {
  return sections.reduce((count, section) => count + section.items.length, 0);
}

function readGroceryItem(value: unknown): GroceryListItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const itemRecord = value as {
    item?: unknown;
    pantryItem?: unknown;
    pantry_item?: unknown;
    quantity?: unknown;
    usedInRecipes?: unknown;
    used_in_recipes?: unknown;
  };

  if (typeof itemRecord.item !== "string" || !itemRecord.item.trim()) {
    return null;
  }

  return {
    item: itemRecord.item,
    pantryItem:
      itemRecord.pantryItem === true || itemRecord.pantry_item === true,
    quantity:
      typeof itemRecord.quantity === "string"
        ? itemRecord.quantity
        : undefined,
    usedInRecipes: Array.isArray(itemRecord.usedInRecipes)
      ? itemRecord.usedInRecipes.filter(
          (recipe): recipe is string => typeof recipe === "string",
        )
      : Array.isArray(itemRecord.used_in_recipes)
        ? itemRecord.used_in_recipes.filter(
            (recipe): recipe is string => typeof recipe === "string",
          )
        : undefined,
  };
}

export function readGrocerySections(value: unknown): GroceryListSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sections: GroceryListSection[] = value
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const record = section as { items?: unknown; name?: unknown };
      const items: GroceryListItem[] = Array.isArray(record.items)
        ? record.items
            .map(readGroceryItem)
            .filter((item): item is GroceryListItem => item !== null)
        : [];

      if (!items.length) {
        return null;
      }

      return {
        items,
        name:
          typeof record.name === "string" && record.name.trim()
            ? record.name
            : "Groceries",
      };
    })
    .filter((section): section is GroceryListSection => section !== null);

  return sections;
}

function normalizedQuantity(quantity?: string) {
  const normalized = quantity?.replace(/\s+/g, " ").trim();

  return normalized || undefined;
}

function flattenSections(sections: GroceryListSection[] | null | undefined) {
  const items = new Map<string, GroceryMapItem>();
  let itemCount = 0;

  for (const section of sections ?? []) {
    for (const item of section.items) {
      const trimmedItem = item.item.trim();

      if (!trimmedItem) {
        continue;
      }

      itemCount += 1;

      const canonicalName = normalizeIngredientName(trimmedItem);

      if (items.has(canonicalName)) {
        continue;
      }

      items.set(canonicalName, {
        canonicalName,
        item: trimmedItem,
        quantity: normalizedQuantity(item.quantity),
        sectionName: section.name,
      });
    }
  }

  return {
    itemCount,
    items,
  };
}

function byCanonicalName(
  left: GroceryReconciliationItem,
  right: GroceryReconciliationItem,
) {
  return left.canonicalName.localeCompare(right.canonicalName);
}

export function reconcileGroceryList({
  derivedSections,
  storedSections,
}: {
  derivedSections: GroceryListSection[];
  storedSections?: GroceryListSection[] | null;
}): GroceryReconciliation {
  const stored = flattenSections(storedSections);
  const derived = flattenSections(derivedSections);
  const added: GroceryReconciliationItem[] = [];
  const removed: GroceryReconciliationItem[] = [];
  const quantityChanged: GroceryQuantityChange[] = [];
  let unchangedCount = 0;

  for (const [canonicalName, derivedItem] of derived.items.entries()) {
    const storedItem = stored.items.get(canonicalName);

    if (!storedItem) {
      added.push({
        canonicalName,
        item: derivedItem.item,
        quantity: derivedItem.quantity,
      });
      continue;
    }

    if (storedItem.quantity !== derivedItem.quantity) {
      quantityChanged.push({
        canonicalName,
        item: derivedItem.item,
        nextQuantity: derivedItem.quantity,
        previousItem: storedItem.item,
        previousQuantity: storedItem.quantity,
      });
      continue;
    }

    unchangedCount += 1;
  }

  for (const [canonicalName, storedItem] of stored.items.entries()) {
    if (!derived.items.has(canonicalName)) {
      removed.push({
        canonicalName,
        item: storedItem.item,
        quantity: storedItem.quantity,
      });
    }
  }

  added.sort(byCanonicalName);
  removed.sort(byCanonicalName);
  quantityChanged.sort((left, right) =>
    left.canonicalName.localeCompare(right.canonicalName),
  );

  return {
    added,
    derivedItemCount: derived.itemCount,
    hasChanges:
      added.length > 0 || removed.length > 0 || quantityChanged.length > 0,
    quantityChanged,
    removed,
    storedItemCount: stored.itemCount,
    unchangedCount,
  };
}
