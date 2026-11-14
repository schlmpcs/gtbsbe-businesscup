// Accounts <-> Profile mapping and the net worth summary. Task MP8 (#168). Stubs until then: signatures
// are final, bodies throw.
import type { Account, NetWorthSummary, Profile } from '@lifeguessr/types';

/** `base` with cash, retirement and debts from the accounts; excluded accounts are skipped. */
export function accountsToProfile(_accounts: readonly Account[], _base: Profile): Profile {
  throw new Error('not implemented: accountsToProfile (MP8)');
}

/** The inverse, for people who came through the sliders / balance sheet, so Accounts never starts empty. */
export function profileToAccounts(_profile: Profile): Account[] {
  throw new Error('not implemented: profileToAccounts (MP8)');
}

/** Net worth = assets − liabilities (excluded skipped), by group, and the change over the last month. */
export function netWorthSummary(_accounts: readonly Account[]): NetWorthSummary {
  throw new Error('not implemented: netWorthSummary (MP8)');
}
