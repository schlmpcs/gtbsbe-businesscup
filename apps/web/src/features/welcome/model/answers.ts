// What the person tells the /start onboarding about themselves, and how it enters the profile. "About
// you" sets age, ZIP, household and take-home pay; "Add it up" sets cash, retirement and the debts (each
// replaces what was there, so none of the starting sample's numbers survive). Pure (tests: answers.test.ts).
import type { HouseholdFacts, KidAge, Money, Profile } from '@lifeguessr/types';
import { ZipSchema } from '@lifeguessr/types';
import { addDebt, type DebtInput } from '@/state/profileOps';

export type AboutAnswers = { age: string; zip: string; adults: 1 | 2; kids: number; takeHome: string };
export type BalanceAnswers = { cash: string; retirement: string; card: string; student: string; auto: string; personal: string };
export type BalanceField = keyof BalanceAnswers;

export const BALANCE_FIELDS: readonly BalanceField[] = ['cash', 'retirement', 'card', 'student', 'auto', 'personal'];
export const DEBT_FIELDS = ['card', 'student', 'auto', 'personal'] as const satisfies readonly BalanceField[];

export const AGE = { min: 18, max: 80 } as const;
export const MAX_KIDS = 4;
export const EMPTY_ABOUT: AboutAnswers = { age: '', zip: '', adults: 1, kids: 0, takeHome: '' };
export const EMPTY_BALANCES: BalanceAnswers = { cash: '', retirement: '', card: '', student: '', auto: '', personal: '' };

/** A typed dollar amount ("$4,800", "4800.50"), or null when it is not one. Empty counts as 0 when `emptyIsZero`. */
export function parseMoney(raw: string, emptyIsZero = false): Money | null {
  const s = raw.replace(/[$,\s]/g, '');
  if (s === '') return emptyIsZero ? 0 : null;
  const v = Number(s);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

export type AboutErrors = Partial<Record<'age' | 'zip' | 'takeHome', true>>;

/** What is wrong with the answers (nothing: they can be applied). ZIP may be left empty. */
export function aboutErrors(a: AboutAnswers): AboutErrors {
  const e: AboutErrors = {};
  const age = Number(a.age);
  if (!Number.isInteger(age) || age < AGE.min || age > AGE.max) e.age = true;
  if (a.zip !== '' && !ZipSchema.safeParse(a.zip).success) e.zip = true;
  const pay = parseMoney(a.takeHome);
  if (pay === null || pay <= 0) e.takeHome = true;
  return e;
}

/** Kids as the household's age bands (the onboarding asks only how many: school age, the plain case). */
const kidBands = (n: number): KidAge[] => Array.from({ length: Math.max(0, Math.min(MAX_KIDS, n)) }, () => 'schoolAge');

export function applyAbout(p: Profile, a: AboutAnswers): Profile {
  const kids = kidBands(a.kids);
  const facts: HouseholdFacts = {
    adults: a.adults,
    kids,
    bedrooms: Math.min(4, 1 + kids.length) as HouseholdFacts['bedrooms'],
    hasCar: p.householdFacts?.hasCar ?? true,
  };
  const next: Profile = {
    ...p,
    age: { value: Number(a.age), isEstimate: false },
    takeHomePay: { value: parseMoney(a.takeHome) ?? p.takeHomePay.value, isEstimate: false },
    householdFacts: facts,
  };
  if (a.zip !== '') next.zip = a.zip;
  else delete next.zip;
  return next;
}

/** A debt of this kind and balance, at the kind's typical APR (an estimate) and the estimated minimum. */
export type AprOf = (kind: DebtInput['kind'], balance: Money) => number;

/** Cash, retirement and debts from the answers (empty = $0); every earlier debt is replaced. */
export function applyBalances(p: Profile, b: BalanceAnswers, aprOf: AprOf): Profile {
  let next: Profile = {
    ...p,
    cash: { value: parseMoney(b.cash, true) ?? 0, isEstimate: false },
    retirement: { value: parseMoney(b.retirement, true) ?? 0, isEstimate: false },
    debts: [],
  };
  for (const kind of DEBT_FIELDS) {
    const balance = parseMoney(b[kind], true) ?? 0;
    if (balance <= 0) continue;
    next = addDebt(next, { kind, balance, apr: aprOf(kind, balance), aprIsEstimate: true, minPayment: null }).profile;
  }
  return next;
}

/** Net worth the answers add up to: what you own minus what you owe. */
export function balancesNetWorth(b: BalanceAnswers): { assets: Money; liabilities: Money; netWorth: Money } {
  const v = (f: BalanceField) => parseMoney(b[f], true) ?? 0;
  const assets = v('cash') + v('retirement');
  const liabilities = DEBT_FIELDS.reduce((s, f) => s + v(f), 0);
  return { assets, liabilities, netWorth: assets - liabilities };
}

/** The form, prefilled from a profile the person made earlier (never from the sample). */
export function answersFrom(p: Profile): { about: AboutAnswers; balances: BalanceAnswers } {
  const debt = (kind: string) => p.debts.filter((d) => d.kind === kind).reduce((s, d) => s + d.balance, 0);
  const str = (v: number) => (v > 0 ? String(Math.round(v)) : '');
  return {
    about: {
      age: String(p.age.value), zip: p.zip ?? '', adults: p.householdFacts?.adults ?? 1,
      kids: p.householdFacts?.kids.length ?? 0, takeHome: str(p.takeHomePay.value),
    },
    balances: {
      cash: str(p.cash.value), retirement: str(p.retirement.value), card: str(debt('card')), student: str(debt('student')),
      auto: str(debt('auto')), personal: str(debt('personal') + debt('bnpl')),
    },
  };
}
