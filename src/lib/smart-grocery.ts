import type { ShoppingItemStatus } from "@prisma/client";

import type { GroceryListItem, GroceryListSection } from "./grocery-reconciliation";
import { normalizeIngredientName } from "./ingredients";

export type SmartGroceryPantryStaple = {
  active: boolean;
  canonicalName: string;
  displayName: string;
};

export type SmartGroceryShoppingState = {
  canonicalName: string;
  itemName: string;
  quantity: string | null;
  status: ShoppingItemStatus;
};

export type SmartGrocerySuggestion = {
  canonicalName: string;
  frequency?: number;
  itemName: string;
  quantity?: string;
  reason: string;
};

export type SmartGrocerySuggestions = {
  currentPlanMissing: SmartGrocerySuggestion[];
  pantryCandidates: SmartGrocerySuggestion[];
  recurringAdditions: SmartGrocerySuggestion[];
};

function normalizeQuantity(value?: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  return normalized || undefined;
}

function itemCanonicalName(item: Pick<GroceryListItem, "item">) {
  return normalizeIngredientName(item.item);
}

function flattenSections(sections: GroceryListSection[] = []) {
  const items = new Map<string, SmartGrocerySuggestion>();

  for (const section of sections) {
    for (const item of section.items) {
      const itemName = item.item.trim();

      if (!itemName) {
        continue;
      }

      const canonicalName = itemCanonicalName(item);

      if (items.has(canonicalName)) {
        continue;
      }

      items.set(canonicalName, {
        canonicalName,
        itemName,
        quantity: normalizeQuantity(item.quantity),
        reason: "",
      });
    }
  }

  return items;
}

function activePantryNames(pantryStaples: SmartGroceryPantryStaple[]) {
  return new Set(
    pantryStaples
      .filter((staple) => staple.active)
      .map((staple) => staple.canonicalName),
  );
}

function byCanonicalName(
  left: Pick<SmartGrocerySuggestion, "canonicalName">,
  right: Pick<SmartGrocerySuggestion, "canonicalName">,
) {
  return left.canonicalName.localeCompare(right.canonicalName);
}

export function buildSmartGrocerySuggestions({
  derivedSections,
  pantryStaples,
  recentGrocerySections,
  shoppingItemStates,
  storedSections,
}: {
  derivedSections: GroceryListSection[];
  pantryStaples: SmartGroceryPantryStaple[];
  recentGrocerySections: GroceryListSection[][];
  shoppingItemStates: SmartGroceryShoppingState[];
  storedSections: GroceryListSection[] | null;
}): SmartGrocerySuggestions {
  const derived = flattenSections(derivedSections);
  const stored = flattenSections(storedSections ?? []);
  const pantryNames = activePantryNames(pantryStaples);
  const currentPlanMissing = Array.from(derived.values())
    .filter(
      (item) => !stored.has(item.canonicalName) && !pantryNames.has(item.canonicalName),
    )
    .map((item) => ({
      ...item,
      reason: "Needed by the current planned dinners.",
    }))
    .toSorted(byCanonicalName);
  const excludedRecurring = new Set([
    ...derived.keys(),
    ...stored.keys(),
    ...pantryNames,
  ]);
  const recentCounts = new Map<
    string,
    SmartGrocerySuggestion & { frequency: number }
  >();

  for (const sections of recentGrocerySections) {
    const weekItems = flattenSections(sections);

    for (const item of weekItems.values()) {
      if (excludedRecurring.has(item.canonicalName)) {
        continue;
      }

      const existing = recentCounts.get(item.canonicalName);

      recentCounts.set(item.canonicalName, {
        canonicalName: item.canonicalName,
        frequency: (existing?.frequency ?? 0) + 1,
        itemName: existing?.itemName ?? item.itemName,
        quantity: existing?.quantity ?? item.quantity,
        reason: "",
      });
    }
  }

  const recurringAdditions = Array.from(recentCounts.values())
    .filter((item) => item.frequency >= 2)
    .map((item) => ({
      ...item,
      reason: `Appeared on ${item.frequency} recent grocery lists.`,
    }))
    .toSorted(byCanonicalName);
  const pantryCounts = new Map<
    string,
    SmartGrocerySuggestion & { frequency: number }
  >();

  for (const item of shoppingItemStates) {
    if (item.status !== "ALREADY_HAVE" || pantryNames.has(item.canonicalName)) {
      continue;
    }

    const existing = pantryCounts.get(item.canonicalName);

    pantryCounts.set(item.canonicalName, {
      canonicalName: item.canonicalName,
      frequency: (existing?.frequency ?? 0) + 1,
      itemName: existing?.itemName ?? item.itemName,
      quantity: existing?.quantity ?? normalizeQuantity(item.quantity),
      reason: "",
    });
  }

  const pantryCandidates = Array.from(pantryCounts.values())
    .filter((item) => item.frequency >= 3)
    .map((item) => ({
      canonicalName: item.canonicalName,
      frequency: item.frequency,
      itemName: item.itemName,
      reason: `Marked already on hand ${item.frequency} times.`,
    }))
    .toSorted(byCanonicalName);

  return {
    currentPlanMissing,
    pantryCandidates,
    recurringAdditions,
  };
}

function acceptedSuggestionsByName({
  acceptedCanonicalNames,
  smartSuggestions,
}: {
  acceptedCanonicalNames: string[];
  smartSuggestions: SmartGrocerySuggestions;
}) {
  const accepted = new Set(acceptedCanonicalNames);
  const suggestions = [
    ...smartSuggestions.currentPlanMissing,
    ...smartSuggestions.recurringAdditions,
  ];

  return suggestions.filter((suggestion) => accepted.has(suggestion.canonicalName));
}

export function mergeSmartGrocerySelections({
  acceptedCanonicalNames,
  smartSuggestions,
  storedSections,
}: {
  acceptedCanonicalNames: string[];
  smartSuggestions: SmartGrocerySuggestions;
  storedSections: GroceryListSection[] | null;
}): GroceryListSection[] {
  const existingNames = new Set(flattenSections(storedSections ?? []).keys());
  const smartItems = acceptedSuggestionsByName({
    acceptedCanonicalNames,
    smartSuggestions,
  })
    .filter((item) => !existingNames.has(item.canonicalName))
    .map((item) => ({
      item: item.itemName,
      quantity: item.quantity,
    }));
  const preservedSections =
    storedSections
      ?.map((section) => ({
        items: section.items.map((item) => ({
          item: item.item,
          ...(item.pantryItem ? { pantryItem: true } : {}),
          ...(item.quantity ? { quantity: item.quantity } : {}),
          ...(item.usedInRecipes?.length
            ? { usedInRecipes: item.usedInRecipes }
            : {}),
        })),
        name: section.name,
      }))
      .filter((section) => section.items.length > 0) ?? [];

  if (!smartItems.length) {
    return preservedSections;
  }

  return [
    ...preservedSections,
    {
      items: smartItems,
      name: "Smart additions",
    },
  ];
}
