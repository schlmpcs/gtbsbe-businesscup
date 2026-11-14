// The Transactions store (MP10, P3): the user's statement lines, kept in the browser only.
//
// - Lines live in IndexedDB (./idb; localStorage is too small for a year of lines), in memory when
//   IndexedDB is unavailable. They are never sent to our API (CLAUDE.md rule 6). The one network
//   call is the existing categorize request of a CSV import, which carries only the masked label,
//   amount, month and day of each line (readStatementFile → toStatementItems).
// - CSV import reuses the T6/T7 pipeline as is: the browser parser and masker, then
//   /api/statement/categorize. Each line it sorted becomes a LedgerTransaction with its masked label.
//   Re-importing a file adds nothing: a line's id is a hash of its date, amount and label (plus how
//   many identical lines came before it in the same file, so two equal coffees on one day stay two).
// - Manual lines (Debit/Credit, amount, merchant, date, account, category, goal) are made here with
//   no AI call; their merchant text stays local.
// - A category override marks the line `categoryOverridden`; "apply to all from this merchant"
//   changes every line with the same `merchantKey`.
// - Totals are the engine's `statementTotals` over the stored lines (one-offs logic unchanged), so
//   Budget, Cash Flow, Recurring and the profile's statement-apply path read the same numbers.
//
// Sign: a LedgerTransaction has amount > 0 = money IN; a StatementItem (and the CSV reader) has
// amount > 0 = money OUT. The conversion is in one place each way (fromClassified / toClassifiedItem).
import {
  merchantKey, statementTotals, type ClassifiedStatementItem,
} from '@lifeguessr/engine';
import {
  LedgerTransactionSchema, STATEMENT_CLASSES, type CategoryTotals, type LedgerTransaction, type Money,
  type StatementClass, type StatementItem,
} from '@lifeguessr/types';
import {
  readStatementFile as defaultReadStatementFile, type ReadStatementDeps,
} from '@/features/upload/model/readStatementFile';
import type { StatementFileResult } from '@/features/upload/model/types';
import { downloadTextFile, type DownloadOutcome } from '@/lib/download';
import { getAnonId, newUuid } from '@/state/anonId';
import { openRecordStore, type RecordStore } from './idb';

/**
 * A stored line: the contract's LedgerTransaction plus the categorizer's one-off hint for imported
 * lines, kept so the totals apply the same one-off rules the statement review did. Browser only.
 */
export type StoredTransaction = LedgerTransaction & { oneOffHint?: boolean };

export const TRANSACTIONS_DB = 'lifeguessr';
export const TRANSACTIONS_STORE = 'transactions';
/** Lines per page of the Transactions list. */
export const TRANSACTIONS_PAGE_SIZE = 50;

// ----- conversions (pure) ---------------------------------------------------------------------

const toCents = (dollars: Money) => Math.round(dollars * 100);

/** cyrb53: a fast 53-bit string hash, as base 36. Stable across browsers (no crypto, no async). */
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * The id of an imported line: a hash of its date, amount (in cents, ledger sign) and masked label.
 * `occurrence` counts identical lines before it in the same file (0 for the first).
 */
export function importedTransactionId(date: string, amount: Money, label: string, occurrence = 0): string {
  const base = `csv-${hash53(`${date}|${toCents(amount)}|${label}`)}`;
  return occurrence === 0 ? base : `${base}-${occurrence}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Lines the categorizer sorted → stored lines, ids by `importedTransactionId`. */
export function fromClassified(items: readonly ClassifiedStatementItem[]): StoredTransaction[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const date = `${item.month}-${pad2(item.day)}`;
    const amount = -item.amount; // statement sign (+ out) → ledger sign (+ in)
    const base = importedTransactionId(date, amount, item.label);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return {
      id: importedTransactionId(date, amount, item.label, occurrence),
      date,
      label: item.label,
      amount,
      cls: item.cls,
      categoryOverridden: false,
      oneOffHint: item.oneOffHint,
    };
  });
}

/** A stored line as the engine's statement line (amount > 0 = money out). */
export function toClassifiedItem(t: StoredTransaction): ClassifiedStatementItem {
  return {
    label: t.label,
    amount: -t.amount,
    month: t.date.slice(0, 7),
    day: Number(t.date.slice(8, 10)),
    cls: t.cls,
    oneOffHint: t.oneOffHint ?? false,
  };
}

const byDateAsc = (a: StoredTransaction, b: StoredTransaction) => a.date.localeCompare(b.date);
const byDateDesc = (a: StoredTransaction, b: StoredTransaction) => b.date.localeCompare(a.date);

/** CategoryTotals per month from the stored lines, by the engine's `statementTotals`. */
export function transactionTotals(lines: readonly StoredTransaction[]): CategoryTotals[] {
  return statementTotals([...lines].sort(byDateAsc).map(toClassifiedItem));
}

/**
 * What Recurring passes to `detectSubscriptions(items, { classOf })`: the lines as statement items
 * (oldest first) and each label's class (the last line's class wins for a label seen in several).
 */
export function recurringInput(lines: readonly StoredTransaction[]): {
  items: StatementItem[];
  classOf: (label: string) => StatementClass | undefined;
} {
  const sorted = [...lines].sort(byDateAsc);
  const classes = new Map(sorted.map((t) => [t.label, t.cls]));
  return {
    items: sorted.map((t) => {
      const { cls: _cls, oneOffHint: _hint, ...item } = toClassifiedItem(t);
      return item;
    }),
    classOf: (label) => classes.get(label),
  };
}

// ----- list: filters and pages (pure) ---------------------------------------------------------

export type TransactionFilter = {
  /** Case-insensitive text in the label. */
  search?: string;
  /** Inclusive 'YYYY-MM-DD' bounds. */
  from?: string;
  to?: string;
  /** The line's category (any StatementClass). */
  cls?: StatementClass;
  accountId?: string;
};

/** The lines that pass every filter given, newest first (lines of one day keep their stored order). */
export function filterTransactions<T extends StoredTransaction>(lines: readonly T[], filter: TransactionFilter = {}): T[] {
  const search = filter.search?.trim().toLowerCase() ?? '';
  return lines
    .filter((t) =>
      (search === '' || t.label.toLowerCase().includes(search))
      && (filter.from === undefined || t.date >= filter.from)
      && (filter.to === undefined || t.date <= filter.to)
      && (filter.cls === undefined || t.cls === filter.cls)
      && (filter.accountId === undefined || t.accountId === filter.accountId))
    .sort(byDateDesc);
}

export type TransactionPage<T> = { items: T[]; page: number; pageCount: number; total: number };

/** One page (1-based, clamped to the pages there are) of already filtered and sorted lines. */
export function transactionPage<T>(lines: readonly T[], page = 1, size = TRANSACTIONS_PAGE_SIZE): TransactionPage<T> {
  const pageCount = Math.max(1, Math.ceil(lines.length / size));
  const current = Math.min(pageCount, Math.max(1, Math.floor(Number.isFinite(page) ? page : 1)));
  return { items: lines.slice((current - 1) * size, current * size), page: current, pageCount, total: lines.length };
}

// ----- manual add (pure) ----------------------------------------------------------------------

/** Monarch's add form, minimal. `amount` is the size of the line (> 0); `direction` gives its sign. */
export type ManualTransactionInput = {
  direction: 'debit' | 'credit';   // debit = money out, credit = money in
  amount: Money;
  merchant: string;                // free text; stays in the browser
  date: string;                    // 'YYYY-MM-DD'
  cls: StatementClass;
  accountId?: string;              // an MP8 account id
  goalId?: string;
};

export type ManualTransactionField = 'amount' | 'merchant' | 'date' | 'category' | 'account' | 'goal';

export class TransactionInputError extends Error {
  readonly field: ManualTransactionField;
  constructor(field: ManualTransactionField, message: string) {
    super(message);
    this.name = 'TransactionInputError';
    this.field = field;
  }
}

const FIELD_OF: Record<string, ManualTransactionField> = {
  amount: 'amount', label: 'merchant', date: 'date', cls: 'category', accountId: 'account', goalId: 'goal',
};

/** A manual line from the form, validated against the contract; throws TransactionInputError. */
export function manualTransaction(input: ManualTransactionInput, id: string): LedgerTransaction {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new TransactionInputError('amount', 'amount must be a positive number of dollars');
  }
  if (!(STATEMENT_CLASSES as readonly string[]).includes(input.cls)) {
    throw new TransactionInputError('category', `unknown category ${String(input.cls)}`);
  }
  const accountId = input.accountId?.trim();
  const goalId = input.goalId?.trim();
  const line = {
    id,
    date: input.date,
    label: input.merchant.trim(),
    amount: input.direction === 'debit' ? -input.amount : input.amount,
    ...(accountId ? { accountId } : {}),
    cls: input.cls,
    // The user picked the category on the form; there is no categorizer verdict to override.
    categoryOverridden: false,
    ...(goalId ? { goalId } : {}),
  };
  const parsed = LedgerTransactionSchema.safeParse(line);
  if (!parsed.success) {
    const key = String(parsed.error.issues[0]?.path[0] ?? 'label');
    throw new TransactionInputError(FIELD_OF[key] ?? 'merchant', parsed.error.issues[0]?.message ?? 'invalid line');
  }
  return parsed.data;
}

// ----- export (pure + download) ---------------------------------------------------------------

export const TRANSACTIONS_FILE_NAME = 'lifeguessr-transactions.csv';
/**
 * Column names of the exported file. Date, Description and signed Amount (money out negative) are
 * what the CSV reader looks for, so the file can be imported again.
 */
export const TRANSACTIONS_CSV_COLUMNS = ['Date', 'Description', 'Amount', 'Category', 'Account', 'Goal', 'Category edited'] as const;

/** A CSV cell: quoted when needed; text a spreadsheet would run as a formula is prefixed with '. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]|^\s|\s$/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The lines as a CSV text (newest first), for the user's own copy. */
export function transactionsToCsv(lines: readonly StoredTransaction[]): string {
  const rows = [...lines].sort(byDateDesc).map((t) => [
    t.date,
    csvCell(t.label),
    t.amount.toFixed(2),
    t.cls,
    csvCell(t.accountId ?? ''),
    csvCell(t.goalId ?? ''),
    t.categoryOverridden ? 'yes' : 'no',
  ].join(','));
  return [TRANSACTIONS_CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Saves the lines as a CSV file, in the browser (lib/download: nothing is uploaded). */
export function exportTransactionsCsv(lines: readonly StoredTransaction[]): DownloadOutcome {
  return downloadTextFile(TRANSACTIONS_FILE_NAME, 'text/csv', transactionsToCsv(lines));
}

// ----- the store ------------------------------------------------------------------------------

/** Why an import could not be stored, after the file was read. */
export class TransactionImportError extends Error {
  readonly problem: 'unsorted';
  constructor(message: string) {
    super(message);
    this.name = 'TransactionImportError';
    this.problem = 'unsorted'; // the categorizer did not say how it sorted each line
  }
}

export type ImportResult = {
  added: number;
  /** Lines already in the store (same date, amount and label), left as they were. */
  duplicates: number;
  summary: StatementFileResult['summary'];
  followUps: StatementFileResult['followUps'];
};

export type TransactionStoreOptions = {
  db?: RecordStore<StoredTransaction>;
  /** The T6/T7 pipeline (swappable in tests). */
  readStatementFile?: typeof defaultReadStatementFile;
  /** Ids for manual lines. */
  newId?: () => string;
};

export type TransactionStore = {
  /** Reads the stored lines (once); every other method waits for it. */
  load(): Promise<void>;
  /** Every line, newest first. The same array until the lines change (for useSyncExternalStore). */
  list(): readonly StoredTransaction[];
  subscribe(listener: () => void): () => void;
  /** Reads a CSV through the T6/T7 pipeline and stores the lines that are not there yet. */
  importFile(file: File, deps?: ReadStatementDeps): Promise<ImportResult>;
  addManual(input: ManualTransactionInput): Promise<LedgerTransaction>;
  /** Sets a line's category; with `applyToMerchant`, every line with its merchantKey. Returns lines changed. */
  setCategory(id: string, cls: StatementClass, opts?: { applyToMerchant?: boolean }): Promise<number>;
  remove(ids: readonly string[]): Promise<number>;
  clear(): Promise<void>;
};

export function createTransactionStore(opts: TransactionStoreOptions = {}): TransactionStore {
  const readFile = opts.readStatementFile ?? defaultReadStatementFile;
  const newId = opts.newId ?? (() => `manual-${newUuid()}`);
  let db: RecordStore<StoredTransaction> | null = opts.db ?? null;
  const records = () => (db ??= openRecordStore<StoredTransaction>(TRANSACTIONS_DB, TRANSACTIONS_STORE));

  let lines: readonly StoredTransaction[] = [];
  let loading: Promise<void> | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();

  const publish = (next: StoredTransaction[]) => {
    lines = next.sort(byDateDesc);
    for (const l of listeners) l();
  };

  /** Persistence is best effort: a failed write (full disk) keeps the lines in memory for this tab. */
  const persist = async (work: (db: RecordStore<StoredTransaction>) => Promise<void>) => {
    try {
      await work(records());
    } catch {
      // keep working in memory
    }
  };

  const load = () =>
    (loading ??= records().getAll().then(
      (stored) => {
        const ids = new Set(stored.map((s) => s.id));
        publish([...stored, ...lines.filter((t) => !ids.has(t.id))]);
      },
      () => undefined, // unreadable: start empty, in memory
    ));

  /** Runs changes one at a time, after the load, so two imports never dedupe against stale lines. */
  const run = <T>(change: () => Promise<T>): Promise<T> => {
    const next = queue.then(load).then(change);
    queue = next.catch(() => undefined);
    return next;
  };

  return {
    load,
    list: () => lines,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async importFile(file, deps = {}) {
      // Read and categorize outside the queue (it is the slow part); store inside it.
      const read = await readFile(file, { ...deps, anonId: deps.anonId ?? getAnonId() });
      if (!read.classified) throw new TransactionImportError('The categorizer did not return a class per line');
      const incoming = fromClassified(read.classified);
      return run(async () => {
        const have = new Set(lines.map((t) => t.id));
        const fresh = incoming.filter((t) => !have.has(t.id));
        if (fresh.length > 0) {
          publish([...lines, ...fresh]);
          await persist((d) => d.putMany(fresh));
        }
        return { added: fresh.length, duplicates: incoming.length - fresh.length, summary: read.summary, followUps: read.followUps };
      });
    },

    addManual(input) {
      const line = manualTransaction(input, newId());
      return run(async () => {
        publish([...lines, line]);
        await persist((d) => d.putMany([line]));
        return line;
      });
    },

    setCategory(id, cls, { applyToMerchant = false } = {}) {
      if (!(STATEMENT_CLASSES as readonly string[]).includes(cls)) {
        return Promise.reject(new TransactionInputError('category', `unknown category ${String(cls)}`));
      }
      return run(async () => {
        const target = lines.find((t) => t.id === id);
        if (!target) return 0;
        const key = merchantKey(target.label);
        // A label that is all masks and digits has an empty key: never treat those as one merchant.
        const hit = (t: StoredTransaction) => t.id === id || (applyToMerchant && key !== '' && merchantKey(t.label) === key);
        const changed: StoredTransaction[] = [];
        const next = lines.map((t) => {
          if (!hit(t)) return t;
          const edited = { ...t, cls, categoryOverridden: true };
          changed.push(edited);
          return edited;
        });
        publish(next);
        await persist((d) => d.putMany(changed));
        return changed.length;
      });
    },

    remove(ids) {
      return run(async () => {
        const gone = new Set(ids);
        const next = lines.filter((t) => !gone.has(t.id));
        const removed = lines.length - next.length;
        if (removed > 0) {
          publish(next);
          await persist((d) => d.deleteMany([...gone]));
        }
        return removed;
      });
    },

    clear() {
      return run(async () => {
        publish([]);
        await persist((d) => d.clear());
      });
    },
  };
}

/** The app's one Transactions store (IndexedDB is opened on first use, in the browser). */
export const transactionStore: TransactionStore = createTransactionStore();

// ----- "Delete all my data" -------------------------------------------------------------------

type DataClearer = () => void | Promise<void>;
const clearers = new Set<DataClearer>();

/**
 * Adds a browser-only store to "Delete all my data". Accounts (MP8, lib/model/accounts.ts) and
 * scenarios (MP7, lib/model/profile.ts) register here when they land. Returns the unregister call.
 */
export function registerDataClearer(clear: DataClearer): () => void {
  clearers.add(clear);
  return () => clearers.delete(clear);
}

/**
 * "Delete all my data": clears the transactions and every registered store (accounts, scenarios).
 * Every clearer runs even when one fails; then the first failure is thrown.
 */
export async function deleteAllMyData(store: TransactionStore = transactionStore): Promise<void> {
  const results = await Promise.allSettled([store.clear(), ...[...clearers].map((c) => Promise.resolve().then(c))]);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) throw failed.reason;
}
