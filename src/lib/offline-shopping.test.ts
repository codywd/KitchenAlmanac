import { describe, expect, it } from "vitest";

import {
  applyOfflineShoppingMutations,
  createOfflineShoppingSnapshot,
  enqueueOfflineShoppingMutation,
  summarizeOfflineShoppingQueue,
  type OfflineShoppingMutation,
} from "./offline-shopping";
import type { ShoppingItem } from "./shopping";

const baseItems: ShoppingItem[] = [
  {
    canonicalName: "onion",
    defaultedFromPantry: false,
    itemName: "Yellow onions",
    pantryItem: false,
    quantity: "2 medium",
    sectionName: "Imported",
    status: "NEEDED",
    updatedBy: null,
  },
  {
    canonicalName: "olive oil",
    defaultedFromPantry: true,
    itemName: "Olive oil",
    pantryItem: true,
    quantity: "1 bottle",
    sectionName: "Pantry / on hand",
    status: "ALREADY_HAVE",
    updatedBy: null,
  },
];

function mutation(
  overrides: Partial<OfflineShoppingMutation>,
): OfflineShoppingMutation {
  return {
    attempts: 0,
    canonicalName: "onion",
    createdAt: "2026-05-01T12:00:00.000Z",
    id: "mutation_1",
    itemName: "Yellow onions",
    quantity: "2 medium",
    status: "BOUGHT",
    syncState: "queued",
    weekId: "week_1",
    ...overrides,
  };
}

describe("offline shopping helpers", () => {
  it("keeps queued mutations ordered by creation time", () => {
    const queue = enqueueOfflineShoppingMutation(
      [mutation({ createdAt: "2026-05-01T12:05:00.000Z", id: "later" })],
      mutation({ createdAt: "2026-05-01T12:00:00.000Z", id: "earlier" }),
    );

    expect(queue.map((item) => item.id)).toEqual(["earlier", "later"]);
  });

  it("applies queued mutations over a cached snapshot using last write wins", () => {
    const applied = applyOfflineShoppingMutations(baseItems, [
      mutation({
        createdAt: "2026-05-01T12:00:00.000Z",
        id: "first",
        status: "BOUGHT",
      }),
      mutation({
        createdAt: "2026-05-01T12:01:00.000Z",
        id: "second",
        status: "ALREADY_HAVE",
      }),
    ]);

    expect(applied).toEqual([
      expect.objectContaining({
        canonicalName: "olive oil",
        pendingSyncState: null,
        status: "ALREADY_HAVE",
      }),
      expect.objectContaining({
        canonicalName: "onion",
        pendingMutationId: "second",
        pendingSyncState: "queued",
        status: "ALREADY_HAVE",
      }),
    ]);
  });

  it("keeps failed mutations visible and summarized for retry", () => {
    const queue = [
      mutation({
        attempts: 1,
        lastError: "Network request failed.",
        syncState: "failed",
      }),
    ];
    const applied = applyOfflineShoppingMutations(baseItems, queue);

    expect(applied.find((item) => item.canonicalName === "onion")).toEqual(
      expect.objectContaining({
        pendingSyncState: "failed",
        status: "BOUGHT",
      }),
    );
    expect(summarizeOfflineShoppingQueue(queue)).toEqual({
      failedCount: 1,
      queuedCount: 0,
      syncingCount: 0,
    });
  });

  it("creates a one-week offline snapshot without sharing item references", () => {
    const snapshot = createOfflineShoppingSnapshot({
      capturedAt: "2026-05-01T12:00:00.000Z",
      items: baseItems,
      weekId: "week_1",
    });

    baseItems[0].status = "BOUGHT";

    expect(snapshot).toEqual({
      capturedAt: "2026-05-01T12:00:00.000Z",
      items: [
        expect.objectContaining({
          canonicalName: "onion",
          status: "NEEDED",
        }),
        expect.objectContaining({
          canonicalName: "olive oil",
        }),
      ],
      weekId: "week_1",
    });
  });
});
