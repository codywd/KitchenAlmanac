import type {
  OfflineShoppingMutation,
  OfflineShoppingSnapshot,
} from "./offline-shopping";

const DB_NAME = "kitchen-almanac-offline-shopping";
const DB_VERSION = 1;
const MUTATION_STORE = "mutations";
const SNAPSHOT_STORE = "snapshots";
const WEEK_INDEX = "weekId";

function indexedDbAvailable() {
  return typeof indexedDB !== "undefined";
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.oncomplete = () => resolve();
  });
}

let openDbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (!indexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  if (!openDbPromise) {
    openDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE, { keyPath: "weekId" });
        }

        if (!db.objectStoreNames.contains(MUTATION_STORE)) {
          const mutationStore = db.createObjectStore(MUTATION_STORE, {
            keyPath: "id",
          });

          mutationStore.createIndex(WEEK_INDEX, WEEK_INDEX, { unique: false });
        }
      };
    });
  }

  return openDbPromise;
}

export async function saveOfflineShoppingSnapshot(
  snapshot: OfflineShoppingSnapshot,
) {
  if (!indexedDbAvailable()) {
    return;
  }

  const db = await openDb();
  const transaction = db.transaction(SNAPSHOT_STORE, "readwrite");
  const store = transaction.objectStore(SNAPSHOT_STORE);

  store.clear();
  store.put(snapshot);

  await transactionDone(transaction);
}

export async function getOfflineShoppingSnapshot(weekId: string) {
  if (!indexedDbAvailable()) {
    return null;
  }

  const db = await openDb();
  const transaction = db.transaction(SNAPSHOT_STORE, "readonly");
  const store = transaction.objectStore(SNAPSHOT_STORE);
  const snapshot = await requestToPromise<OfflineShoppingSnapshot | undefined>(
    store.get(weekId),
  );

  return snapshot ?? null;
}

export async function listOfflineShoppingMutations(weekId: string) {
  if (!indexedDbAvailable()) {
    return [] as OfflineShoppingMutation[];
  }

  const db = await openDb();
  const transaction = db.transaction(MUTATION_STORE, "readonly");
  const store = transaction.objectStore(MUTATION_STORE);
  const index = store.index(WEEK_INDEX);

  return requestToPromise<OfflineShoppingMutation[]>(index.getAll(weekId));
}

export async function putOfflineShoppingMutation(
  mutation: OfflineShoppingMutation,
) {
  if (!indexedDbAvailable()) {
    return;
  }

  const db = await openDb();
  const transaction = db.transaction(MUTATION_STORE, "readwrite");

  transaction.objectStore(MUTATION_STORE).put(mutation);

  await transactionDone(transaction);
}

export async function deleteOfflineShoppingMutation(id: string) {
  if (!indexedDbAvailable()) {
    return;
  }

  const db = await openDb();
  const transaction = db.transaction(MUTATION_STORE, "readwrite");

  transaction.objectStore(MUTATION_STORE).delete(id);

  await transactionDone(transaction);
}
