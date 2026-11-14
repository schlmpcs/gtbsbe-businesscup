// The daily spending log in the app store: pure helpers behind its actions. Entries live in this
// browser only (localStorage); they are never synced to the server session.
import { DailyEntrySchema, SpendItemSchema, type DailyEntry, type SpendItem } from '@lifeguessr/types';

/** Most entries kept; past it the oldest are dropped (about a year of a busy log). */
export const DAILY_ENTRIES_MAX = 2_000;

/** New entries for `items` on `date` ('YYYY-MM-DD'), appended; invalid items throw (zod). */
export function appendEntries(
  entries: readonly DailyEntry[],
  items: readonly SpendItem[],
  date: string,
  newId: () => string,
): { entries: DailyEntry[]; added: DailyEntry[] } {
  const added = items.map((item) => DailyEntrySchema.parse({ ...SpendItemSchema.parse(item), id: newId(), date }));
  const all = [...entries, ...added];
  return { entries: all.length > DAILY_ENTRIES_MAX ? all.slice(all.length - DAILY_ENTRIES_MAX) : all, added };
}

/** The entries without `ids` (undo of an add, or a delete). */
export function withoutEntries(entries: readonly DailyEntry[], ids: readonly string[]): DailyEntry[] {
  const drop = new Set(ids);
  return entries.filter((e) => !drop.has(e.id));
}

/** The entries of one month ('YYYY-MM'), newest day first; same-day entries newest first. */
export function entriesInMonth(entries: readonly DailyEntry[], month: string): DailyEntry[] {
  return entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.date.startsWith(`${month}-`))
    .sort((a, b) => (a.e.date === b.e.date ? b.i - a.i : a.e.date < b.e.date ? 1 : -1))
    .map(({ e }) => e);
}

/** Saved entries, read back one by one: a broken entry is dropped, the rest are kept. */
export function restoreDailyEntries(saved: unknown): DailyEntry[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((e) => {
    const parsed = DailyEntrySchema.safeParse(e);
    return parsed.success ? [parsed.data] : [];
  }).slice(-DAILY_ENTRIES_MAX);
}
