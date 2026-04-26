import type { ShoppingItemStatus } from "@prisma/client";

import type { GroceryListSection } from "./grocery-reconciliation";
import { normalizeIngredientName } from "./ingredients";

export type ShoppingPantryStaple = {
  active: boolean;
  canonicalName: string;
  displayName: string;
};

export type ShoppingItemStateInput = {
  canonicalName: string;
  itemName: string;
  quantity: string | null;
  status: ShoppingItemStatus;
  updatedBy: {
    email: string;
    name: string | null;
  } | null;
};

export type ShoppingItem = {
  canonicalName: string;
  defaultedFromPantry: boolean;
  itemName: string;
  pantryItem: boolean;
  quantity: string | null;
  sectionName: string;
  status: ShoppingItemStatus;
  updatedBy: ShoppingItemStateInput["updatedBy"];
};

type SourceShoppingItem = {
  canonicalName: string;
  itemName: string;
  pantryItem: boolean;
  quantity: string | null;
  sectionName: string;
};

function normalizeQuantity(value?: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  return normalized || null;
}

function sourceItemsFromSections(sections: GroceryListSection[]) {
  const seen = new Set<string>();
  const items: SourceShoppingItem[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      const itemName = item.item.trim();

      if (!itemName) {
        continue;
      }

      const canonicalName = normalizeIngredientName(itemName);

      if (seen.has(canonicalName)) {
        continue;
      }

      seen.add(canonicalName);
      items.push({
        canonicalName,
        itemName,
        pantryItem: item.pantryItem === true || item.pantry_item === true,
        quantity: normalizeQuantity(item.quantity),
        sectionName: section.name,
      });
    }
  }

  return items.sort((left, right) =>
    left.canonicalName.localeCompare(right.canonicalName),
  );
}

export function buildShoppingItems({
  derivedSections,
  itemStates,
  pantryStaples,
  storedSections,
}: {
  derivedSections: GroceryListSection[];
  itemStates: ShoppingItemStateInput[];
  pantryStaples: ShoppingPantryStaple[];
  storedSections?: GroceryListSection[] | null;
}): ShoppingItem[] {
  const sourceSections = storedSections?.length ? storedSections : derivedSections;
  const statesByName = new Map(
    itemStates.map((state) => [state.canonicalName, state]),
  );
  const activePantryNames = new Set(
    pantryStaples
      .filter((staple) => staple.active)
      .map((staple) => staple.canonicalName),
  );

  return sourceItemsFromSections(sourceSections).map((source) => {
    const state = statesByName.get(source.canonicalName);
    const defaultedFromPantry =
      !state && (source.pantryItem || activePantryNames.has(source.canonicalName));

    return {
      canonicalName: source.canonicalName,
      defaultedFromPantry,
      itemName: source.itemName,
      pantryItem: source.pantryItem || activePantryNames.has(source.canonicalName),
      quantity: source.quantity,
      sectionName: source.sectionName,
      status: state?.status ?? (defaultedFromPantry ? "ALREADY_HAVE" : "NEEDED"),
      updatedBy: state?.updatedBy ?? null,
    };
  });
}

export function groupShoppingItems(items: ShoppingItem[]) {
  return {
    ALREADY_HAVE: items.filter((item) => item.status === "ALREADY_HAVE"),
    BOUGHT: items.filter((item) => item.status === "BOUGHT"),
    NEEDED: items.filter((item) => item.status === "NEEDED"),
  } satisfies Record<ShoppingItemStatus, ShoppingItem[]>;
}
