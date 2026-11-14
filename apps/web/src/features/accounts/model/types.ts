// View-model contracts of Accounts, Account detail and Add account (MP11, #171). ui/ may import only
// this file, @/ui-kit/** and @/copy (lint-enforced). Hooks: useAccounts, useAccount(id), useAddAccount.
// Units: every Money is unrounded US dollars; a balance is always >= 0 and `kind` says whether it counts
// for (asset) or against (liability) net worth. Rates are decimals per year (0.2436 = 24.36%), except
// the add-account form's text inputs, which hold what the person typed (see `AddAccountFieldVM`).
// Names: copy.planner.accountGroups[group] for groups, copy.accounts for the screens' own words.
// Privacy (CLAUDE.md rule 6): account names and balances stay in this browser.
import type { Account, AccountGroup, Debt, Estimate, Money, Rate, YearMonth } from '@lifeguessr/types';
import type { DownloadOutcome } from '@/lib/download';
import type { TransactionRowVM, NewTransactionInput } from '@/features/transactions/model/types';

export type { Account, AccountGroup, Estimate, Money, Rate, YearMonth } from '@lifeguessr/types';
export type { DownloadOutcome } from '@/lib/download';
export type { TransactionRowVM, NewTransactionInput } from '@/features/transactions/model/types';

export type AccountKind = 'asset' | 'liability';
export type AccountPeriod = '1m' | '3m' | '1y' | 'all';
export type SummaryMode = 'totals' | 'percent';

/** One point of a balance chart: the balance (net worth for the whole picture) at the end of a month. */
export type BalancePointVM = { month: YearMonth; value: Money };

export type AccountRowVM = {
  id: string;
  name: string;
  group: AccountGroup;
  kind: AccountKind;
  /** The balance (>= 0). */
  balance: Money;
  /** The balance is a rough number the person gave, not an exact one. */
  isEstimate: boolean;
  /** Left out of net worth and the plan. */
  excluded: boolean;
  /** Balance change over the last month; null without a balance a month back. */
  change1m: Money | null;
  /** Where the detail page is. */
  href: string;
};

export type AccountGroupVM = {
  group: AccountGroup;
  kind: AccountKind;
  /** Sum of the group's accounts that count (excluded ones left out). */
  total: Money;
  /** Change of those accounts over the last month; null without a balance a month back. */
  change1m: Money | null;
  accounts: AccountRowVM[];
};

/** One bar of the assets-versus-liabilities summary. */
export type SummaryBarVM = {
  kind: AccountKind;
  total: Money;
  /** Share of assets + liabilities, 0..1 (0 when both are 0). */
  share: Rate;
  /** The groups inside the bar, largest first; `share` is of this bar's total. */
  segments: { group: AccountGroup; amount: Money; share: Rate }[];
};

export type AccountsVM = {
  /** False until saved state is loaded (always true on fixtures). */
  ready: boolean;
  /** No accounts at all: show the "add your first account" state. */
  isEmpty: boolean;
  /** Assets - liabilities, excluded accounts left out. */
  netWorth: Money;
  /** Over the last month, like for like (an account added this month is not growth); null when no account had a balance a month back. */
  change1m: Money | null;
  period: AccountPeriod;
  setPeriod: (period: AccountPeriod) => void;
  /** Net worth history for `period`, oldest first, ending with this month. */
  chart: BalancePointVM[];
  /** Asset groups first, then liability groups; empty groups are left out. */
  groups: AccountGroupVM[];
  summaryMode: SummaryMode;
  setSummaryMode: (mode: SummaryMode) => void;
  summary: { assets: SummaryBarVM; liabilities: SummaryBarVM };
  /** Every account is manual, so there is nothing to refresh: hide the button while false. */
  canRefresh: boolean;
  /** The add-account flow is open (useAddAccount drives it). */
  adding: boolean;
  /** Opens the add-account flow. */
  add: () => void;
  /** No-op for manual accounts. */
  refreshAll: () => void;
  /** Saves the accounts as a CSV file. */
  exportCsv: () => DownloadOutcome;
};

// ----- Account detail ------------------------------------------------------------------------------

export type AccountSummaryVM = {
  group: AccountGroup;
  /** Not in the Account contract yet (needs `creditLimit` in packages/types): always null for now. */
  creditLimit: Estimate<Money> | null;
  apr: Rate | null;
  minPayment: Estimate<Money> | null;
  debtKind: Debt['kind'] | null;
  /** The month of the last balance edit; null for an account with no history. */
  lastUpdated: YearMonth | null;
  /** The month of the first balance. */
  created: YearMonth | null;
};

export type AccountDetailVM = AccountRowVM & {
  chart: BalancePointVM[];
  summary: AccountSummaryVM;
  /** This account's lines, newest first. */
  transactions: TransactionRowVM[];
};

export type AccountVM = {
  ready: boolean;
  /** False for an unknown id (or a deleted account): show "not found". */
  found: boolean;
  account: AccountDetailVM | null;
  period: AccountPeriod;
  setPeriod: (period: AccountPeriod) => void;
  /** Sets the balance (>= 0) for this month; false when `value` is not a valid balance. */
  editBalance: (value: Money, isEstimate?: boolean) => boolean;
  /** False for a blank name. */
  rename: (name: string) => boolean;
  /** Leaves the account out of (true) or back in (false) net worth and the plan; no argument toggles. */
  exclude: (excluded?: boolean) => void;
  /** Removes the account; its lines stay in the ledger without an account. */
  delete: () => void;
  /** Adds a line on this account; returns its id, or null when the input is invalid. */
  addTransaction: (input: Omit<NewTransactionInput, 'accountId'>) => string | null;
};

// ----- Add account ---------------------------------------------------------------------------------

export type AddAccountStep = 'pick-type' | 'form';

export type AddAccountFieldId = 'name' | 'balance' | 'apr' | 'minPayment' | 'debtKind' | 'growth';

/**
 * One input of the form. `value` is the text as typed: 'money' in dollars ("1,250.50"), 'percent' in
 * percent ("22.8" = 0.228 per year; the hook converts on submit), 'select' one of `options`.
 * `isEstimate` is the "I'm not sure" tag the person can set on a money field (`canBeEstimate`), or that
 * we set when we filled the field in ourselves (`defaulted`, e.g. a card's minimum payment).
 */
export type AddAccountFieldVM = {
  id: AddAccountFieldId;
  /** Key into copy.accounts.fields. */
  labelKey: AddAccountFieldId;
  input: 'text' | 'money' | 'percent' | 'select';
  value: string;
  required: boolean;
  canBeEstimate: boolean;
  isEstimate: boolean;
  /** Left blank, we fill it in on submit (and tag it an estimate). */
  defaulted: boolean;
  options?: Debt['kind'][];
  /** Set only after a failed `submit`. */
  error: 'required' | 'invalid' | null;
};

export type AddAccountVM = {
  step: AddAccountStep;
  /** The account types to pick from, in display order. */
  groups: { group: AccountGroup; kind: AccountKind }[];
  /** Null on 'pick-type'. */
  group: AccountGroup | null;
  fields: AddAccountFieldVM[];
  pickType: (group: AccountGroup) => void;
  setField: (id: AddAccountFieldId, value: string) => void;
  setEstimate: (id: AddAccountFieldId, isEstimate: boolean) => void;
  /** Adds the account and closes the flow; returns its id, or null (with `error` set on the fields) when the form is invalid. */
  submit: () => string | null;
  /** Back to 'pick-type', keeping nothing typed. */
  back: () => void;
  /** Closes the flow and clears the form. */
  close: () => void;
};

/** What `submit` stores: the Account without its id. */
export type NewAccount = Omit<Account, 'id'>;
