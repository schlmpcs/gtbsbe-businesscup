// "Add account" data (MP8, #168; the modal itself is MP17): the choices, and the form a choice opens.
//
// Choices: Asset → Cash, Investments, Retirement, Real estate, Vehicle, Other; Liability → Credit card,
// Loan, Mortgage. "Connect a bank" is a disabled "coming soon" entry; "Import from CSV" points to the
// Transactions import (MP10). The form is name + balance, plus APR and minimum payment for liabilities,
// prefilled as estimates from the engine defaults and editable.
import { accountsToProfile } from '@lifeguessr/engine';
import {
  ASSET_GROUPS, LIABILITY_GROUPS,
  type Account, type AccountGroup, type Debt, type Estimate, type LiabilityGroup, type Money, type Rate, type YearMonth,
} from '@lifeguessr/types';
import { accounts as copy } from '@/copy';
import { useAppStore } from '@/state/store';

export type LoanKind = Exclude<Debt['kind'], 'card' | 'mortgage'>;
export const LOAN_KINDS = ['auto', 'student', 'personal', 'bnpl'] as const satisfies readonly LoanKind[];
/** The kind a new Loan account starts as (the engine's default for a loan without a kind). */
export const DEFAULT_LOAN_KIND: LoanKind = 'personal';

export const isLiabilityGroup = (g: AccountGroup): g is LiabilityGroup =>
  (LIABILITY_GROUPS as readonly string[]).includes(g);

export type AddAccountOption = { group: AccountGroup; label: string };
export type AddAccountMenu = {
  sections: { side: 'asset' | 'liability'; label: string; options: AddAccountOption[] }[];
  /** No bank connection in this build: shown, never clickable. */
  connectBank: { label: string; note: string; disabled: true };
  /** CSV import lives on Transactions (MP10). */
  importCsv: { label: string; note: string; href: '/transactions' };
  loanKinds: { kind: LoanKind; label: string }[];
};

const option = (group: AccountGroup): AddAccountOption => ({ group, label: copy.groups[group] });

export function addAccountMenu(): AddAccountMenu {
  return {
    sections: [
      { side: 'asset', label: copy.sides.asset, options: ASSET_GROUPS.map(option) },
      { side: 'liability', label: copy.sides.liability, options: LIABILITY_GROUPS.map(option) },
    ],
    connectBank: { label: copy.addMenu.connectBank, note: copy.addMenu.connectBankNote, disabled: true },
    importCsv: { label: copy.addMenu.importCsv, note: copy.addMenu.importCsvNote, href: '/transactions' },
    loanKinds: LOAN_KINDS.map((kind) => ({ kind, label: copy.loanKinds[kind] })),
  };
}

/** What the add form holds. `apr` and `minPayment` (liabilities only) stay estimates until the user types them. */
export type AccountForm = {
  group: AccountGroup;
  name: string;
  /** BALANCE, ≥ 0; the sign comes from the group. */
  balance: Money;
  /** Loan accounts only. */
  debtKind?: LoanKind;
  apr?: Estimate<Rate>;
  /** Monthly. */
  minPayment?: Estimate<Money>;
};

/**
 * The default APR and minimum payment of a liability, tagged estimates: the same numbers the profile
 * gets for it (`accountsToProfile`: the kind's default APR, then today's card formula for cards or the
 * amortized payment over the kind's default term). A typed `apr` is used for the minimum and kept
 * measured.
 */
export function liabilityEstimates(
  group: LiabilityGroup,
  balance: Money,
  opts: { debtKind?: LoanKind; apr?: Rate } = {},
): { apr: Estimate<Rate>; minPayment: Estimate<Money> } {
  const probe: Account = {
    id: 'probe', group, name: 'probe', balance: { value: balance, isEstimate: false }, history: [],
    ...(group === 'loan' && { debtKind: opts.debtKind ?? DEFAULT_LOAN_KIND }),
    ...(opts.apr !== undefined && { apr: opts.apr }),
  };
  // The base profile only supplies fields a debt does not read; the debt comes from the probe alone.
  const debt = accountsToProfile([probe], useAppStore.getState().profile).debts[0]!;
  return {
    apr: { value: debt.apr, isEstimate: opts.apr === undefined },
    minPayment: { value: debt.minPayment.value, isEstimate: true },
  };
}

/** The form a choice opens: the group's label as the name, $0, and the liability estimates. */
export function newAccountForm(group: AccountGroup): AccountForm {
  const form: AccountForm = { group, name: copy.groups[group], balance: 0 };
  return isLiabilityGroup(group) ? withFormBalance(group === 'loan' ? { ...form, debtKind: DEFAULT_LOAN_KIND } : form, 0) : form;
}

/**
 * The form with a new balance (or loan kind): APR and minimum that are still estimates follow it;
 * typed ones are kept. Asset forms only take the balance.
 */
export function withFormBalance(form: AccountForm, balance: Money, debtKind = form.debtKind): AccountForm {
  if (!isLiabilityGroup(form.group)) return { ...form, balance };
  const typedApr = form.apr && !form.apr.isEstimate ? form.apr.value : undefined;
  const est = liabilityEstimates(form.group, balance, {
    ...(debtKind !== undefined && { debtKind }),
    ...(typedApr !== undefined && { apr: typedApr }),
  });
  return {
    ...form,
    balance,
    ...(form.group === 'loan' && { debtKind: debtKind ?? DEFAULT_LOAN_KIND }),
    apr: est.apr,
    minPayment: form.minPayment && !form.minPayment.isEstimate ? form.minPayment : est.minPayment,
  };
}

/**
 * The saved account. The typed balance is measured, with one history point for `month`. An APR or
 * minimum left as an estimate is not stored: the engine fills in the same default (tagged estimate)
 * and the minimum keeps following the balance.
 */
export function accountFromForm(form: AccountForm, id: string, month: YearMonth): Account {
  const account: Account = {
    id,
    group: form.group,
    name: form.name.trim(),
    balance: { value: form.balance, isEstimate: false },
    history: [{ month, balance: form.balance }],
  };
  if (!isLiabilityGroup(form.group)) return account;
  if (form.group === 'loan') account.debtKind = form.debtKind ?? DEFAULT_LOAN_KIND;
  if (form.apr && !form.apr.isEstimate) account.apr = form.apr.value;
  if (form.minPayment && !form.minPayment.isEstimate) account.minPayment = { ...form.minPayment };
  return account;
}
