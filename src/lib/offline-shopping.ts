import type { ShoppingItemStatus } from "@prisma/client";

import type { ShoppingItem } from "./shopping";

export type OfflineShoppingMutation = {
  attempts: number;
  canonicalName: string;
  createdAt: string;
  id: string;
  itemName: string;
  lastError?: string;
  quantity: string | null;
  status: ShoppingItemStatus;
  syncState: "failed" | "queued" | "syncing";
  weekId: string;
};

export type OfflineShoppingSnapshot = {
  capturedAt: string;
  items: ShoppingItem[];
  weekId: string;
};

export type OfflineAppliedShoppingItem = ShoppingItem & {
  pendingError?: string;
  pendingMutationId: string | null;
  pendingSyncState: OfflineShoppingMutation["syncState"] | null;
};

export function sortOfflineShoppingMutations(
  mutations: OfflineShoppingMutation[],
) {
  return [...mutations].sort((left, right) => {
    const timeComparison = left.createdAt.localeCompare(right.createdAt);

    return timeComparison === 0 ? left.id.localeCompare(right.id) : timeComparison;
  });
}

export function enqueueOfflineShoppingMutation(
  existing: OfflineShoppingMutation[],
  mutation: OfflineShoppingMutation,
) {
  return sortOfflineShoppingMutations([...existing, mutation]);
}

function cloneShoppingItem(item: ShoppingItem): ShoppingItem {
  return {
    ...item,
    updatedBy: item.updatedBy ? { ...item.updatedBy } : null,
  };
}

export function createOfflineShoppingSnapshot({
  capturedAt,
  items,
  weekId,
}: {
  capturedAt: string;
  items: ShoppingItem[];
  weekId: string;
}): OfflineShoppingSnapshot {
  return {
    capturedAt,
    items: items.map(cloneShoppingItem),
    weekId,
  };
}

export function applyOfflineShoppingMutations(
  items: ShoppingItem[],
  mutations: OfflineShoppingMutation[],
): OfflineAppliedShoppingItem[] {
  const latestByName = new Map<string, OfflineShoppingMutation>();

  for (const mutation of sortOfflineShoppingMutations(mutations)) {
    latestByName.set(mutation.canonicalName, mutation);
  }

  return items
    .map((item) => {
      const mutation = latestByName.get(item.canonicalName);

      if (!mutation) {
        return {
          ...cloneShoppingItem(item),
          pendingMutationId: null,
          pendingSyncState: null,
        };
      }

      return {
        ...cloneShoppingItem(item),
        itemName: mutation.itemName || item.itemName,
        pendingError: mutation.lastError,
        pendingMutationId: mutation.id,
        pendingSyncState: mutation.syncState,
        quantity: mutation.quantity,
        status: mutation.status,
      };
    })
    .sort((left, right) => left.canonicalName.localeCompare(right.canonicalName));
}

export function summarizeOfflineShoppingQueue(
  mutations: OfflineShoppingMutation[],
) {
  return mutations.reduce(
    (summary, mutation) => {
      if (mutation.syncState === "failed") {
        summary.failedCount += 1;
      } else if (mutation.syncState === "syncing") {
        summary.syncingCount += 1;
      } else {
        summary.queuedCount += 1;
      }

      return summary;
    },
    {
      failedCount: 0,
      queuedCount: 0,
      syncingCount: 0,
    },
  );
}
