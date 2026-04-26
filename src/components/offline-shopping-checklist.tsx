"use client";

import type { ShoppingItemStatus } from "@prisma/client";
import {
  CheckCircle2,
  Circle,
  Home,
  RefreshCcw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  applyOfflineShoppingMutations,
  createOfflineShoppingSnapshot,
  enqueueOfflineShoppingMutation,
  sortOfflineShoppingMutations,
  summarizeOfflineShoppingQueue,
  type OfflineAppliedShoppingItem,
  type OfflineShoppingMutation,
} from "@/lib/offline-shopping";
import {
  deleteOfflineShoppingMutation,
  getOfflineShoppingSnapshot,
  listOfflineShoppingMutations,
  putOfflineShoppingMutation,
  saveOfflineShoppingSnapshot,
} from "@/lib/offline-shopping-store";
import { groupShoppingItems, type ShoppingItem } from "@/lib/shopping";

const statusLabels = {
  ALREADY_HAVE: "Already have",
  BOUGHT: "Bought",
  NEEDED: "Need",
} satisfies Record<ShoppingItemStatus, string>;

const statusIcons = {
  ALREADY_HAVE: Home,
  BOUGHT: CheckCircle2,
  NEEDED: Circle,
} satisfies Record<ShoppingItemStatus, typeof Circle>;

const statusOrder = ["NEEDED", "BOUGHT", "ALREADY_HAVE"] as const;

function personLabel(person: { email: string; name: string | null } | null) {
  return person?.name?.trim() || person?.email || "Not updated yet";
}

function mutationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not sync item.";
}

function updateItemFromServer(
  items: ShoppingItem[],
  state: {
    canonicalName: string;
    itemName: string;
    quantity: string | null;
    status: ShoppingItemStatus;
    updatedBy: {
      email: string;
      name: string | null;
    } | null;
  },
) {
  return items.map((item) =>
    item.canonicalName === state.canonicalName
      ? {
          ...item,
          itemName: state.itemName,
          quantity: state.quantity,
          status: state.status,
          updatedBy: state.updatedBy,
        }
      : item,
  );
}

function SyncBanner({
  failedCount,
  online,
  queuedCount,
  syncing,
  syncingCount,
  onRetry,
}: {
  failedCount: number;
  online: boolean;
  queuedCount: number;
  syncing: boolean;
  syncingCount: number;
  onRetry: () => void;
}) {
  const Icon = online ? Wifi : WifiOff;
  const text = !online
    ? queuedCount + failedCount > 0
      ? `${queuedCount + failedCount} change${
          queuedCount + failedCount === 1 ? "" : "s"
        } queued for sync.`
      : "Offline. This visited list is available on this device."
    : failedCount > 0
      ? `${failedCount} change${failedCount === 1 ? "" : "s"} could not sync.`
      : syncing || syncingCount > 0
        ? "Syncing shopping changes..."
        : queuedCount > 0
          ? `${queuedCount} change${queuedCount === 1 ? "" : "s"} queued.`
          : "Synced for offline shopping.";

  return (
    <div className="ka-panel flex flex-col gap-3 border border-[var(--line)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center bg-[rgba(66,102,63,0.12)] text-[var(--herb-dark)]">
          <Icon size={18} />
        </span>
        <div>
          <div className="text-sm font-black text-[var(--ink)]">
            {online ? "Online shopping mode" : "Offline shopping mode"}
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
            {text}
          </p>
        </div>
      </div>
      {failedCount > 0 ? (
        <button
          className="ka-button-secondary gap-2 self-start"
          disabled={!online || syncing}
          onClick={onRetry}
          type="button"
        >
          <RefreshCcw size={15} />
          Retry sync
        </button>
      ) : null}
    </div>
  );
}

function ShoppingStatusButton({
  disabled,
  item,
  onStatus,
  status,
}: {
  disabled: boolean;
  item: OfflineAppliedShoppingItem;
  onStatus: (item: OfflineAppliedShoppingItem, status: ShoppingItemStatus) => void;
  status: ShoppingItemStatus;
}) {
  const Icon = statusIcons[status];
  const active = item.status === status;

  return (
    <button
      className={`min-h-10 border px-3 text-xs font-black uppercase tracking-[0.1em] transition disabled:opacity-60 ${
        active
          ? "border-[var(--herb)] bg-[rgba(66,102,63,0.14)] text-[var(--herb-dark)]"
          : "border-[var(--line)] bg-[rgba(255,253,245,0.56)] text-[var(--muted-ink)] hover:border-[var(--line-strong)]"
      }`}
      disabled={disabled}
      onClick={() => onStatus(item, status)}
      type="button"
    >
      <Icon size={14} />
      {statusLabels[status]}
    </button>
  );
}

function ShoppingItemCard({
  item,
  onStatus,
}: {
  item: OfflineAppliedShoppingItem;
  onStatus: (item: OfflineAppliedShoppingItem, status: ShoppingItemStatus) => void;
}) {
  return (
    <div className="border border-[var(--line)] bg-[rgba(255,253,245,0.48)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-black capitalize text-[var(--ink)]">
            {item.itemName}
          </h3>
          <p className="mt-1 text-sm font-semibold text-[var(--muted-ink)]">
            {[item.quantity, item.sectionName].filter(Boolean).join(" / ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.pantryItem ? (
              <span className="ka-status-mark" data-tone="muted">
                pantry
              </span>
            ) : null}
            {item.defaultedFromPantry ? (
              <span className="ka-status-mark" data-tone="warm">
                pantry default
              </span>
            ) : null}
            {item.pendingSyncState ? (
              <span
                className="ka-status-mark"
                data-tone={item.pendingSyncState === "failed" ? "danger" : "warm"}
              >
                {item.pendingSyncState === "failed" ? "sync failed" : "queued"}
              </span>
            ) : null}
          </div>
          {item.pendingSyncState === "failed" && item.pendingError ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tomato-dark)]">
              {item.pendingError}
            </p>
          ) : null}
        </div>
        <div className="text-xs font-semibold leading-5 text-[var(--muted-ink)] sm:text-right">
          {item.pendingSyncState
            ? "Queued on this device"
            : `Updated by ${personLabel(item.updatedBy)}`}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {statusOrder.map((status) => (
          <ShoppingStatusButton
            disabled={item.status === status && !item.pendingSyncState}
            item={item}
            key={`${item.canonicalName}-${status}`}
            onStatus={onStatus}
            status={status}
          />
        ))}
      </div>
    </div>
  );
}

function ShoppingGroup({
  emptyText,
  items,
  onStatus,
  title,
}: {
  emptyText: string;
  items: OfflineAppliedShoppingItem[];
  onStatus: (item: OfflineAppliedShoppingItem, status: ShoppingItemStatus) => void;
  title: string;
}) {
  return (
    <section className="ka-section">
      <div>
        <div className="ka-eyebrow">{`${items.length} item${
          items.length === 1 ? "" : "s"
        }.`}</div>
        <h2>{title}</h2>
      </div>
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <ShoppingItemCard
              item={item}
              key={item.canonicalName}
              onStatus={onStatus}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold leading-6 text-[var(--muted-ink)]">
          {emptyText}
        </p>
      )}
    </section>
  );
}

export function OfflineShoppingChecklist({
  currentUser,
  initialItems,
  weekId,
}: {
  currentUser: {
    email: string;
    name: string | null;
  };
  initialItems: ShoppingItem[];
  weekId: string;
}) {
  const router = useRouter();
  const [baseItems, setBaseItems] = useState<ShoppingItem[]>(initialItems);
  const [hydrated, setHydrated] = useState(false);
  const [mutations, setMutations] = useState<OfflineShoppingMutation[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const appliedItems = useMemo(
    () => applyOfflineShoppingMutations(baseItems, mutations),
    [baseItems, mutations],
  );
  const groups = groupShoppingItems(appliedItems);
  const summary = summarizeOfflineShoppingQueue(mutations);

  const syncQueuedMutations = useCallback(
    async (queueOverride?: OfflineShoppingMutation[]) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOnline(false);
        return;
      }

      const queue = sortOfflineShoppingMutations(
        queueOverride ?? (await listOfflineShoppingMutations(weekId)),
      );
      const syncable = queue.filter((mutation) => mutation.syncState !== "syncing");

      if (!syncable.length) {
        return;
      }

      setSyncing(true);

      for (const mutation of syncable) {
        const syncingMutation: OfflineShoppingMutation = {
          ...mutation,
          syncState: "syncing",
        };

        await putOfflineShoppingMutation(syncingMutation);
        setMutations((current) =>
          current.map((item) =>
            item.id === mutation.id ? syncingMutation : item,
          ),
        );

        try {
          const response = await fetch(`/api/weeks/${weekId}/shopping-items`, {
            body: JSON.stringify({
              canonicalName: mutation.canonicalName,
              itemName: mutation.itemName,
              quantity: mutation.quantity,
              status: mutation.status,
            }),
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
            },
            method: "POST",
          });
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
            shoppingItemState?: {
              canonicalName: string;
              itemName: string;
              quantity: string | null;
              status: ShoppingItemStatus;
              updatedBy: {
                email: string;
                name: string | null;
              } | null;
            };
          };

          if (!response.ok || !body.shoppingItemState) {
            throw new Error(body.error ?? "Could not sync item.");
          }

          const syncedIds = queue
            .filter(
              (item) =>
                item.canonicalName === mutation.canonicalName &&
                item.createdAt <= mutation.createdAt,
            )
            .map((item) => item.id);

          await Promise.all(syncedIds.map(deleteOfflineShoppingMutation));
          setBaseItems((current) =>
            updateItemFromServer(current, body.shoppingItemState!),
          );
          setMutations((current) =>
            current.filter((item) => !syncedIds.includes(item.id)),
          );
        } catch (error) {
          const failedMutation: OfflineShoppingMutation = {
            ...mutation,
            attempts: mutation.attempts + 1,
            lastError: errorMessage(error),
            syncState: "failed",
          };

          await putOfflineShoppingMutation(failedMutation);
          setMutations((current) =>
            current.map((item) =>
              item.id === mutation.id ? failedMutation : item,
            ),
          );
        }
      }

      setSyncing(false);
      router.refresh();
    },
    [router, weekId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOfflineState() {
      const onlineNow =
        typeof navigator === "undefined" ? true : navigator.onLine;
      const [snapshot, savedMutations] = await Promise.all([
        getOfflineShoppingSnapshot(weekId),
        listOfflineShoppingMutations(weekId),
      ]);
      const startingItems =
        initialItems.length > 0 ? initialItems : snapshot?.items ?? [];

      if (initialItems.length > 0) {
        await saveOfflineShoppingSnapshot(
          createOfflineShoppingSnapshot({
            capturedAt: new Date().toISOString(),
            items: initialItems,
            weekId,
          }),
        );
      }

      if (cancelled) {
        return;
      }

      setBaseItems(startingItems);
      setMutations(sortOfflineShoppingMutations(savedMutations));
      setOnline(onlineNow);
      setHydrated(true);
    }

    void loadOfflineState();

    return () => {
      cancelled = true;
    };
  }, [initialItems, weekId]);

  useEffect(() => {
    function refreshOnlineState() {
      setOnline(navigator.onLine);
    }

    window.addEventListener("online", refreshOnlineState);
    window.addEventListener("offline", refreshOnlineState);

    return () => {
      window.removeEventListener("online", refreshOnlineState);
      window.removeEventListener("offline", refreshOnlineState);
    };
  }, []);

  useEffect(() => {
    if (hydrated && online) {
      const syncTimer = window.setTimeout(() => {
        void syncQueuedMutations();
      }, 0);

      return () => window.clearTimeout(syncTimer);
    }
  }, [hydrated, online, syncQueuedMutations]);

  const handleStatus = useCallback(
    async (item: OfflineAppliedShoppingItem, status: ShoppingItemStatus) => {
      const mutation: OfflineShoppingMutation = {
        attempts: 0,
        canonicalName: item.canonicalName,
        createdAt: new Date().toISOString(),
        id: mutationId(),
        itemName: item.itemName,
        quantity: item.quantity,
        status,
        syncState: "queued",
        weekId,
      };
      const nextQueue = enqueueOfflineShoppingMutation(mutations, mutation);

      await putOfflineShoppingMutation(mutation);
      setMutations(nextQueue);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        void syncQueuedMutations(nextQueue);
      }
    },
    [mutations, syncQueuedMutations, weekId],
  );

  if (!hydrated) {
    return null;
  }

  return (
    <div className="grid gap-5">
      <SyncBanner
        failedCount={summary.failedCount}
        online={online}
        onRetry={() => void syncQueuedMutations(mutations)}
        queuedCount={summary.queuedCount}
        syncing={syncing}
        syncingCount={summary.syncingCount}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="ka-panel border border-[var(--line)]">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            Need
          </div>
          <div className="mt-2 text-3xl font-black text-[var(--ink)]">
            {groups.NEEDED.length}
          </div>
        </div>
        <div className="ka-panel border border-[var(--line)]">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            Bought
          </div>
          <div className="mt-2 text-3xl font-black text-[var(--ink)]">
            {groups.BOUGHT.length}
          </div>
        </div>
        <div className="ka-panel border border-[var(--line)]">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            Already have
          </div>
          <div className="mt-2 text-3xl font-black text-[var(--ink)]">
            {groups.ALREADY_HAVE.length}
          </div>
        </div>
      </div>

      {appliedItems.length ? (
        <>
          <ShoppingGroup
            emptyText="Nothing left to buy."
            items={groups.NEEDED as OfflineAppliedShoppingItem[]}
            onStatus={handleStatus}
            title="Need"
          />
          <ShoppingGroup
            emptyText="No bought items yet."
            items={groups.BOUGHT as OfflineAppliedShoppingItem[]}
            onStatus={handleStatus}
            title="Bought"
          />
          <ShoppingGroup
            emptyText="No pantry items marked for this week."
            items={groups.ALREADY_HAVE as OfflineAppliedShoppingItem[]}
            onStatus={handleStatus}
            title="Already Have"
          />
        </>
      ) : (
        <section className="ka-section">
          <h2>No Grocery Items</h2>
          <p className="text-sm font-semibold leading-6 text-[var(--muted-ink)]">
            Refresh the grocery list from ingredients or import a weekly plan, then
            this page becomes the shared shopping checklist.
          </p>
        </section>
      )}

      <div className="sr-only" aria-live="polite">
        Shopping changes for {currentUser.name ?? currentUser.email} are{" "}
        {summary.failedCount > 0
          ? "waiting for retry"
          : summary.queuedCount > 0 || summary.syncingCount > 0
            ? "syncing"
            : "synced"}
        .
      </div>
    </div>
  );
}
