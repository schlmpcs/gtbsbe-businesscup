// The demo bank link's banks (DEMO, not a real bank connection). Each bank is made up: a name in
// copy/bankDemo.ts that says "(demo)", our own initials tile (no logo), and one of the synthetic
// statements in packages/data/fixtures/synthetic-statements that it "holds". The statement is served as
// a CSV by GET /api/statement/demo/<id> and read through the same CSV pipeline as an uploaded file.
// Shared by the browser flow and that route, so it holds no copy and no Node imports.

export const DEMO_BANK_IDS = ['maple', 'harbor', 'summit', 'juniper', 'lantern', 'pebble', 'bluebird'] as const;
export type DemoBankId = (typeof DEMO_BANK_IDS)[number];

/** Which chart color the bank's tile uses (tokens: --color-chart-1 … 5). */
export type DemoBankTone = 1 | 2 | 3 | 4 | 5;

export type DemoBank = {
  id: DemoBankId;
  /** Two letters on the tile. */
  initials: string;
  tone: DemoBankTone;
  /** File name in packages/data/fixtures/synthetic-statements (one of DEMO_STATEMENT_FILES). */
  statement: string;
};

export const DEMO_BANKS: readonly DemoBank[] = [
  { id: 'maple', initials: 'MC', tone: 4, statement: 'hh13-elk-grove-single-income-family.csv' },
  { id: 'harbor', initials: 'HB', tone: 1, statement: 'hh01-austin-single-renter.csv' },
  { id: 'summit', initials: 'SS', tone: 5, statement: 'hh31-austin-software-engineer.csv' },
  { id: 'juniper', initials: 'JF', tone: 2, statement: 'hh04-bronx-nurse-single-parent.csv' },
  { id: 'lantern', initials: 'LO', tone: 3, statement: 'hh08-la-new-grad-roommates.csv' },
  { id: 'pebble', initials: 'PM', tone: 1, statement: 'hh02-queens-retail-roommates.csv' },
  { id: 'bluebird', initials: 'BB', tone: 5, statement: 'hh21-chandler-young-family.csv' },
];

export function isDemoBankId(id: string): id is DemoBankId {
  return (DEMO_BANK_IDS as readonly string[]).includes(id);
}

export function demoBank(id: DemoBankId): DemoBank {
  return DEMO_BANKS.find((b) => b.id === id)!;
}

/** Where the browser downloads a demo bank's statement (a static CSV; nothing is sent with it). */
export const demoStatementUrl = (id: DemoBankId): string => `/api/statement/demo/${id}`;

/** File name the statement gets when it is handed to the CSV pipeline. */
export const demoStatementFileName = (id: DemoBankId): string => `${id}-demo-statement.csv`;

/** Banks whose name contains every word of `query` (case-insensitive); all of them for an empty query. */
export function searchDemoBanks(query: string, nameOf: (id: DemoBankId) => string): DemoBank[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...DEMO_BANKS];
  return DEMO_BANKS.filter((b) => {
    const name = nameOf(b.id).toLowerCase();
    return words.every((w) => name.includes(w));
  });
}
