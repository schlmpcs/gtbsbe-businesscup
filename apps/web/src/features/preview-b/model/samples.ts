// Sample props for the tool-screen design previews (/preview/tools/*). Server components: the pages import
// this and pass plain data to the client UI. S23 and S24 run the real engine on a sample profile;
// the other screens use static sample numbers because their engine functions haven't landed yet.
import { findArea } from '@lifeguessr/data/areas';
import demoProfile from '@lifeguessr/data/fixtures/profile.demo.json';
import { serviceById } from '@lifeguessr/data/subscriptions';
import { comparePayoff, extraToFinishBy, overpayingCheck } from '@lifeguessr/engine';
import type { Debt, Profile } from '@lifeguessr/types';
import type {
  HouseholdVM,
  LittleThingsVM,
  OverpayingVM,
  PayoffVM,
  RunwayVM,
  SubscriptionRowVM,
  ToolsHubVM,
  YearlyVM,
} from './types';

/** Preview "today": fixed so the screenshots don't move. */
const START = { year: 2026, month: 11 }; // December 2026 (0-based month)
const monthLabel = (offset: number) =>
  new Date(Date.UTC(START.year, START.month + offset, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export const hubSample: ToolsHubVM = {
  tools: [
    { slug: 'subscriptions', href: '/preview/tools/subscriptions', minutes: 2, accent: 'primary' },
    { slug: 'overpaying', href: '/preview/tools/overpaying', minutes: 2, accent: 'chart-1' },
    { slug: 'payoff', href: '/preview/tools/payoff', minutes: 3, accent: 'chart-3' },
    { slug: 'runway', href: '/preview/tools/runway', minutes: 1, accent: 'chart-4' },
    { slug: 'yearly', href: '/preview/tools/yearly', minutes: 2, accent: 'chart-5' },
    { slug: 'household', href: '/preview/tools/household', minutes: 4, accent: 'chart-2' },
  ],
};

// S21: catalog prices and sources from packages/data/subscriptions.json; 10-year totals and goal days
// are static preview numbers (the real screen gets them from the engine's habit cost and goal delay).
function sub(id: string, tenYear: number, goalDays: number, initial: 'keep' | 'cut'): SubscriptionRowVM {
  const s = serviceById(id);
  if (!s) throw new Error(`Unknown service ${id}`);
  const plan = s.plans[0]!;
  return {
    id,
    name: s.name,
    price: plan.price,
    cadence: plan.cadence === 'yearly' ? 'yearly' : 'monthly',
    tenYear,
    goalDays,
    isEstimate: s.isEstimate,
    source: s.source,
    initial,
  };
}
export const littleThingsSample: LittleThingsVM = {
  guess: { initial: 60, min: 0, max: 400, step: 5 },
  actual: 169,
  survey: { guessed: 86, paid: 219 },
  maybe: [
    { id: 'm1', label: 'SQ *CITY PARKING', amount: 24, months: 3 },
    { id: 'm2', label: 'PAYPAL *LEARNAPP', amount: 12.99, months: 4 },
  ],
  subscriptions: [
    sub('netflix', 1_400, 4, 'keep'),
    sub('spotify', 2_020, 6, 'keep'),
    sub('hulu', 1_870, 5, 'cut'),
    sub('amazon-prime', 1_800, 5, 'keep'),
    sub('planet-fitness', 2_340, 7, 'cut'),
  ],
  habits: [
    { id: 'coffee', name: 'Coffee out', perWeek: 5, price: 6, tenYear: 20_200, goalDays: 58, isEstimate: true, initial: 'half' },
    { id: 'delivery', name: 'Food delivery', perWeek: 2, price: 28, tenYear: 37_700, goalDays: 104, isEstimate: true, initial: 'keep' },
    { id: 'lunch', name: 'Lunch out', perWeek: 3, price: 14, tenYear: 28_300, goalDays: 80, isEstimate: true, initial: 'keep' },
  ],
  summary: { count: 3, tenYear: 9_800, goalWeeks: 7 },
};

// S23: the real overpaying engine on the demo profile, with costs set so some lines sit above range.
const overpayingInput = { bedrooms: 1, adults: 2, kids: ['toddler'], rent: 2_750, groceries: 960, childcare: 1_250, carInsurance: 240 } as const;
function overpaying(): OverpayingVM {
  const zip = (demoProfile as Profile).zip ?? '75206';
  const area = findArea(zip);
  const base = demoProfile as unknown as Profile;
  const profile: Profile = {
    ...base,
    spending: {
      ...base.spending,
      rentUtilities: { value: overpayingInput.rent, isEstimate: false },
      childcare: { value: overpayingInput.childcare, isEstimate: false },
      groceries: { value: overpayingInput.groceries, isEstimate: false },
      car: { value: 520, isEstimate: true },
    },
    takeHomePay: { value: 8_600, isEstimate: false },
  };
  const result = overpayingCheck({ ...overpayingInput, kids: [...overpayingInput.kids] }, area, profile);
  const order = ['rent', 'groceries', 'childcare', 'carInsurance'] as const;
  const rows = order.flatMap((line) => {
    const l = result.lines.find((x) => x.line === line);
    return l
      ? [{ line, yours: l.yours, low: l.typical.low, high: l.typical.high, source: l.source, isEstimate: l.isEstimate, position: l.position, gapPerMonth: l.gapPerMonth }]
      : [];
  });
  return {
    zip,
    metro: result.metro ?? '',
    bedrooms: overpayingInput.bedrooms,
    rows,
    summary: {
      gapPerMonth: result.lines.reduce((s, l) => s + l.gapPerMonth, 0),
      effect10y: result.lines.reduce((s, l) => s + l.effect10y, 0),
      goalWeeks: 9, // static: goal delay isn't in the engine yet
    },
  };
}

// S24: the real payoff engine on the demo debts plus a small student loan.
const payoffDebts: Debt[] = [
  ...(demoProfile as unknown as Profile).debts,
  { id: 'student-1', kind: 'student', balance: 4_800, apr: 0.055, minPayment: { value: 95, isEstimate: false } },
];
function payoff(): PayoffVM {
  const extra = 200;
  const targetMonths = 36;
  const c = comparePayoff(payoffDebts, extra);
  const plans = (['avalanche', 'snowball', 'minimum'] as const).map((method) => {
    const p = c[method];
    return {
      method,
      months: p.monthsToDebtFree,
      debtFreeLabel: p.monthsToDebtFree === null ? '—' : monthLabel(p.monthsToDebtFree),
      totalInterest: p.totalInterest,
      interestSaved: p.interestSavedVsMinimum,
      monthsSooner: p.monthsSavedVsMinimum,
      order: p.order,
    };
  });
  return {
    debts: payoffDebts.map((d) => ({ id: d.id, kind: d.kind, balance: d.balance, apr: d.apr, minPayment: d.minPayment.value, isEstimate: d.minPayment.isEstimate })),
    extra,
    plans,
    target: {
      initial: monthLabel(targetMonths),
      options: [24, 36, 48].map((m) => ({ label: monthLabel(m), ...extraToFinishBy(payoffDebts, m, 'avalanche') })),
    },
  };
}

export const runwaySample: RunwayVM = {
  cash: 3_800,
  essentials: 2_950,
  months: 1.3,
  targets: [
    { months: 3, need: 8_850, shortfall: 5_050 },
    { months: 6, need: 17_700, shortfall: 13_900 },
  ],
  close: { target: 3, options: [ { months: 6, perMonth: 842 }, { months: 12, perMonth: 421 }, { months: 24, perMonth: 210 } ] },
  fill: 1.3 / 6,
  marks: [ { months: 3, at: 0.5 }, { months: 6, at: 1 } ],
};

const MONTHS = Array.from({ length: 12 }, (_, i) => monthLabel(i));
const bills = [
  { id: 'car-ins', name: 'Car insurance (6 months)', amount: 1_080, dueMonth: MONTHS[2]!, isEstimate: false },
  { id: 'prime', name: 'Amazon Prime', amount: 139, dueMonth: MONTHS[3]!, isEstimate: true },
  { id: 'reg', name: 'Car registration', amount: 95, dueMonth: MONTHS[4]!, isEstimate: true },
  { id: 'renters', name: 'Renters insurance', amount: 180, dueMonth: MONTHS[6]!, isEstimate: true },
  { id: 'car-ins-2', name: 'Car insurance (6 months)', amount: 1_080, dueMonth: MONTHS[8]!, isEstimate: false },
  { id: 'gifts', name: 'Holiday gifts', amount: 600, dueMonth: MONTHS[0]!, isEstimate: true },
];
const shortWithout: Record<number, number> = { 2: 410, 8: 260 };
export const yearlySample: YearlyVM = {
  bills,
  setAside: 264,
  without: MONTHS.map((month, i) => ({ month, bill: bills.filter((b) => b.dueMonth === month).reduce((s, b) => s + b.amount, 0), short: shortWithout[i] ?? 0 })),
  withSetAside: MONTHS.map((month) => ({ month, bill: bills.filter((b) => b.dueMonth === month).reduce((s, b) => s + b.amount, 0), short: 0 })),
  firstShort: { month: MONTHS[2]!, amount: 410 },
};

export const householdSample: HouseholdVM = {
  adults: [
    { id: 'a1', role: 'you', income: 5_200 },
    { id: 'a2', role: 'partner', income: 3_900 },
  ],
  kids: [
    { id: 'k1', band: 'toddler' },
    { id: 'k2', band: 'schoolAge' },
  ],
  shared: [
    { group: 'housing', amount: 2_400, shared: true },
    { group: 'groceries', amount: 960, shared: true },
    { group: 'childcare', amount: 1_250, shared: true },
    { group: 'car', amount: 520, shared: false },
    { group: 'subscriptions', amount: 85, shared: false },
    { group: 'eatingOut', amount: 340, shared: true },
  ],
  split: [
    { id: 'a1', role: 'you', share: 0.571, amount: 2_829 },
    { id: 'a2', role: 'partner', share: 0.429, amount: 2_121 },
  ],
};

export const overpayingSample = (): OverpayingVM => overpaying();
export const payoffSample = (): PayoffVM => payoff();
