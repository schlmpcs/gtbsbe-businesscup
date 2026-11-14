// Accounts <-> Profile mapping and the net worth summary. Task MP8 (#168).
//
// Accounts are the balance sheet the person keeps (browser only, names are personal). The profile the
// rest of the engine reads is derived from them: cash = Σ cash, retirement = Σ retirement + investments,
// every liability → a Debt. Real estate is the profile's home (JF4): its value is Σ included real estate
// accounts. Vehicles and other assets have no profile field yet; they count in `netWorthSummary` only.
// Excluded accounts count nowhere.
import {
  LIABILITY_GROUPS,
  type Account,
  type AssetGroup,
  type Debt,
  type Estimate,
  type LiabilityGroup,
  type Money,
  type NetWorthSummary,
  type Profile,
  type Rate,
} from '@lifeguessr/types';
import { debtAprDefaults, debtTermMonthsDefault } from './assumptions';
import { addMonths } from './events';
import { defaultHome } from './home';
import { amortizedPayment } from './loan/amortize';
import { cardMinPaymentFor } from './simulate';

const isLiability = (g: Account['group']): g is LiabilityGroup =>
  (LIABILITY_GROUPS as readonly string[]).includes(g);

const included = (accounts: readonly Account[]) => accounts.filter((a) => !a.excluded);

/** Σ balances of the accounts in `groups`; an estimate when any of them is. */
function sumOf(accounts: readonly Account[], groups: readonly Account['group'][]): Estimate<Money> {
  let value = 0;
  let isEstimate = false;
  for (const a of accounts) {
    if (!groups.includes(a.group)) continue;
    value += a.balance.value;
    isEstimate ||= a.balance.isEstimate;
  }
  return { value, isEstimate };
}

function debtKindOf(a: Account): Debt['kind'] {
  if (a.group === 'creditCard') return 'card';
  if (a.group === 'mortgage') return 'mortgage';
  return a.debtKind ?? 'personal';
}

/** The typed minimum, else today's card formula (cards) or the amortized payment over the default term. */
function minPaymentOf(a: Account, kind: Debt['kind'], apr: Rate): Estimate<Money> {
  if (a.minPayment) return { ...a.minPayment };
  const balance = a.balance.value;
  const value = kind === 'card'
    ? cardMinPaymentFor(balance, apr)
    : amortizedPayment(balance, apr, debtTermMonthsDefault.value[kind]);
  return { value, isEstimate: true };
}

/** Id of the real estate account `profileToAccounts` makes for the profile's home. */
export const HOME_ACCOUNT_ID = 'home';

/**
 * The profile's home after the accounts (JF4). No real estate account at all (included or not): the
 * base home, unchanged. Otherwise the value is Σ included real estate balances (0 when all are
 * excluded) and the appreciation their balance-weighted `growth` when any sets one (the others count at
 * the base home's rate). Without a base home, one is made only when an included real estate account
 * exists: tenure 'mortgage' when an included mortgage account exists, else 'outright', default
 * appreciation (`defaultHome`), no HOA.
 */
function homeOf(accounts: readonly Account[], live: readonly Account[], base: Profile): Profile['home'] {
  if (!accounts.some((a) => a.group === 'realEstate')) return base.home;
  const homes = live.filter((a) => a.group === 'realEstate');
  if (!base.home && homes.length === 0) return undefined;
  const start = base.home ?? defaultHome(live.some((a) => a.group === 'mortgage') ? 'mortgage' : 'outright')!;
  const value = sumOf(homes, ['realEstate']);
  let appreciation = { ...start.appreciation };
  if (homes.some((a) => a.growth !== undefined)) {
    const rateOf = (a: Account) => a.growth ?? start.appreciation.value;
    const rate = homes.length === 1
      ? rateOf(homes[0]!)
      : value.value > 0
        ? homes.reduce((s, a) => s + rateOf(a) * a.balance.value, 0) / value.value
        : homes.reduce((s, a) => s + rateOf(a), 0) / homes.length;
    // An unchanged rate keeps its estimate flag (the round trip through profileToAccounts).
    if (rate !== start.appreciation.value) appreciation = { value: rate, isEstimate: false };
  }
  return { ...start, value, appreciation };
}

/**
 * `base` with cash, retirement, debts and the home (see `homeOf`) from the accounts; excluded accounts
 * are skipped.
 */
export function accountsToProfile(accounts: readonly Account[], base: Profile): Profile {
  const live = included(accounts);
  const baseDebts = new Map(base.debts.map((d) => [d.id, d]));
  const debts: Debt[] = live.filter((a) => isLiability(a.group)).map((a) => {
    const kind = debtKindOf(a);
    const apr = a.apr ?? debtAprDefaults.value[kind];
    const debt: Debt = { id: a.id, kind, balance: a.balance.value, apr, minPayment: minPaymentOf(a, kind, apr) };
    // Accounts carry no extra payment (moves set it on the profile), so keep the base debt's.
    const extra = baseDebts.get(a.id)?.extraPayment;
    if (extra !== undefined) debt.extraPayment = extra;
    return debt;
  });
  const { home: _home, ...rest } = base;
  const home = homeOf(accounts, live, base);
  return {
    ...rest,
    cash: sumOf(live, ['cash']),
    retirement: sumOf(live, ['retirement', 'investments']),
    debts,
    ...(home && { home }),
  };
}

const DEBT_ACCOUNT: Record<Debt['kind'], { group: LiabilityGroup; name: string }> = {
  card: { group: 'creditCard', name: 'Credit card' },
  auto: { group: 'loan', name: 'Auto loan' },
  student: { group: 'loan', name: 'Student loan' },
  personal: { group: 'loan', name: 'Personal loan' },
  bnpl: { group: 'loan', name: 'Buy now, pay later' },
  mortgage: { group: 'mortgage', name: 'Mortgage' },
};

/**
 * The inverse, for people who came through the sliders / balance sheet, so Accounts never starts empty:
 * one Checking (cash) and one Retirement account, always, one Home (real estate, id `HOME_ACCOUNT_ID`,
 * balance = home value, growth = its appreciation) for an owner, plus one account per debt (same id). History
 * holds one point at `profile.asOf` when the profile has it (the engine has no clock). Account balances
 * are never negative, so an overdrawn (negative) cash balance becomes a $0 Checking account.
 */
export function profileToAccounts(profile: Profile): Account[] {
  const history = (balance: Money) => (profile.asOf ? [{ month: profile.asOf, balance }] : []);
  const cash = Math.max(0, profile.cash.value);
  const accounts: Account[] = [
    { id: 'cash', group: 'cash', name: 'Checking', balance: { value: cash, isEstimate: profile.cash.isEstimate }, history: history(cash) },
    { id: 'retirement', group: 'retirement', name: 'Retirement', balance: { ...profile.retirement }, history: history(profile.retirement.value) },
  ];
  if (profile.home) {
    accounts.push({
      id: HOME_ACCOUNT_ID,
      group: 'realEstate',
      name: 'Home',
      balance: { ...profile.home.value },
      growth: profile.home.appreciation.value,
      history: history(profile.home.value.value),
    });
  }
  for (const d of profile.debts) {
    const { group, name } = DEBT_ACCOUNT[d.kind];
    accounts.push({
      id: d.id,
      group,
      name,
      balance: { value: d.balance, isEstimate: false },
      apr: d.apr,
      minPayment: { ...d.minPayment },
      ...(group === 'loan' && { debtKind: d.kind }),
      history: history(d.balance),
    });
  }
  return accounts;
}

/** The account's balance at the end of `month`: its last history point at or before it, if any. */
function balanceAt(a: Account, month: string): Money | undefined {
  let best: { month: string; balance: Money } | undefined;
  for (const h of a.history) if (h.month <= month && (!best || h.month >= best.month)) best = h;
  return best?.balance;
}

/** Net worth = assets − liabilities (excluded skipped), by group, and the change over the last month. */
export function netWorthSummary(accounts: readonly Account[]): NetWorthSummary {
  const live = included(accounts);
  const assets = { total: 0, byGroup: {} as Partial<Record<AssetGroup, Money>> };
  const liabilities = { total: 0, byGroup: {} as Partial<Record<LiabilityGroup, Money>> };
  for (const a of live) {
    const v = a.balance.value;
    if (isLiability(a.group)) {
      liabilities.total += v;
      liabilities.byGroup[a.group] = (liabilities.byGroup[a.group] ?? 0) + v;
    } else {
      assets.total += v;
      assets.byGroup[a.group] = (assets.byGroup[a.group] ?? 0) + v;
    }
  }
  const netWorth = assets.total - liabilities.total;

  // change1m: today's net worth minus the one at the end of the month before the latest history month.
  // An account with no point that far back counts as unchanged (its history starts when it was entered).
  let change1m: Money | null = null;
  const latest = live.flatMap((a) => a.history.map((h) => h.month)).reduce<string | null>(
    (max, m) => (max === null || m > max ? m : max), null);
  if (latest !== null) {
    const prevMonth = addMonths(latest, -1);
    let then = 0;
    let anyPoint = false;
    for (const a of live) {
      const past = balanceAt(a, prevMonth);
      anyPoint ||= past !== undefined;
      const v = past ?? a.balance.value;
      then += isLiability(a.group) ? -v : v;
    }
    if (anyPoint) change1m = netWorth - then;
  }

  return { netWorth, assets, liabilities, change1m };
}
