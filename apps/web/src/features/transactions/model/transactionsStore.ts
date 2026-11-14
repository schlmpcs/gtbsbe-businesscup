// The ledger the planner screens read: the Transactions store of MP10 (lib/model/transactions.ts), kept
// in IndexedDB in this browser. Hooks read it through `useLedger`, never the store directly, so a test
// can swap in a store on a memory record store (`setLedgerStore`).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { transactionStore, type StoredTransaction, type TransactionStore } from '@/lib/model/transactions';

export type { StoredTransaction, TransactionStore } from '@/lib/model/transactions';

let active: TransactionStore = transactionStore;
const loaded = new WeakSet<TransactionStore>();

/** The store the hooks use: the app's one Transactions store unless a test replaced it. */
export const ledger = (): TransactionStore => active;

/** Replace the store the hooks use (tests); `null` goes back to the app's own. */
export function setLedgerStore(store: TransactionStore | null): void {
  active = store ?? transactionStore;
}

/** Marks a store as already loaded, so the first render of a hook is `ready` (tests). */
export function markLedgerLoaded(store: TransactionStore): void {
  loaded.add(store);
}

/** The stored lines, newest first, and whether they are loaded from IndexedDB yet. */
export function useLedger(): { lines: readonly StoredTransaction[]; ready: boolean } {
  const store = ledger();
  const lines = useSyncExternalStore(store.subscribe, store.list, store.list);
  const [ready, setReady] = useState(() => loaded.has(store));
  useEffect(() => {
    if (ready) return undefined;
    let live = true;
    void store.load().then(() => {
      loaded.add(store);
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [store, ready]);
  return { lines, ready };
}
