// A tiny IndexedDB wrapper for browser-only records keyed by `id` (MP10: the Transactions store).
// localStorage is too small for a year of statement lines, so they go to IndexedDB. When IndexedDB is
// missing or refuses to open (the server, some private windows, blocked site data), the records are
// kept in memory for this tab instead, so a screen keeps working and nothing throws on open.
//
// Nothing here talks to the network: the records never leave the browser.

/** Records keyed by their `id`, in IndexedDB or in memory. */
export type RecordStore<T extends { id: string }> = {
  getAll(): Promise<T[]>;
  /** Adds or replaces each record by its id. */
  putMany(records: readonly T[]): Promise<void>;
  deleteMany(ids: readonly string[]): Promise<void>;
  clear(): Promise<void>;
};

/** The memory fallback (also what tests use: there is no IndexedDB in Node). */
export function memoryRecordStore<T extends { id: string }>(initial: readonly T[] = []): RecordStore<T> {
  const records = new Map<string, T>(initial.map((r) => [r.id, structuredClone(r)]));
  return {
    getAll: async () => [...records.values()].map((r) => structuredClone(r)),
    putMany: async (list) => {
      for (const r of list) records.set(r.id, structuredClone(r));
    },
    deleteMany: async (ids) => {
      for (const id of ids) records.delete(id);
    },
    clear: async () => records.clear(),
  };
}

const requestDone = <R>(req: IDBRequest<R>) =>
  new Promise<R>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });

function openDb(factory: IDBFactory, dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(dbName, 1);
    } catch (err) {
      reject(err); // Firefox private windows used to throw here
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function idbRecordStore<T extends { id: string }>(db: IDBDatabase, storeName: string): RecordStore<T> {
  /** Runs `work` in one transaction and resolves once it has committed. */
  const write = (work: (store: IDBObjectStore) => void) =>
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
      work(tx.objectStore(storeName));
    });
  return {
    getAll: () => requestDone(db.transaction(storeName, 'readonly').objectStore(storeName).getAll() as IDBRequest<T[]>),
    putMany: (records) => (records.length === 0 ? Promise.resolve() : write((s) => records.forEach((r) => s.put(r)))),
    deleteMany: (ids) => (ids.length === 0 ? Promise.resolve() : write((s) => ids.forEach((id) => s.delete(id)))),
    clear: () => write((s) => s.clear()),
  };
}

function defaultFactory(): IDBFactory | undefined {
  try {
    return typeof indexedDB === 'undefined' ? undefined : indexedDB;
  } catch {
    return undefined; // reading it throws in some sandboxed frames
  }
}

/**
 * The records of `storeName` in the IndexedDB database `dbName`, opened on first use. Falls back to
 * memory when IndexedDB is unavailable or will not open. Later write errors (a full disk) reject, so
 * the caller decides whether to carry on in memory.
 */
export function openRecordStore<T extends { id: string }>(
  dbName: string,
  storeName: string,
  factory: IDBFactory | undefined = defaultFactory(),
): RecordStore<T> {
  let backend: Promise<RecordStore<T>> | null = null;
  const get = () =>
    (backend ??= factory
      ? openDb(factory, dbName, storeName).then(
          (db) => idbRecordStore<T>(db, storeName),
          () => memoryRecordStore<T>(),
        )
      : Promise.resolve(memoryRecordStore<T>()));
  return {
    getAll: async () => (await get()).getAll(),
    putMany: async (records) => (await get()).putMany(records),
    deleteMany: async (ids) => (await get()).deleteMany(ids),
    clear: async () => (await get()).clear(),
  };
}
