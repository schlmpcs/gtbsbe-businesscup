// Fixture stand-ins for the engine while plan() / defaultEvent() / buyHomeBreakdown() are stubs (MP3,
// MP4). MP7b deletes this file and calls the engine instead. Nothing here is engine output and none of
// it ships as a result: the numbers start from the PLACEHOLDER plan fixture (plan.demo.json) and move
// by the plain yearly effect of the events the person added or changed against the Baseline scenario
// the fixture was made from (no growth, no interest on cash; today's dollars).
import { accountsDemo, planDemo, scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { getArea } from '@lifeguessr/data/areas';
import type { Account, BuyHomeBreakdown, PlanEvent, PlanEventOf, PlanEventType, PlanKpis, PlanResult, PlanYear, Scenario } from '@lifeguessr/types';
import type { PlanEventIconId } from './types';

/** The ZIP of the demo profile; its area data gives the sources the editor shows. */
export const FIXTURE_AREA = getArea('75206');

export const EVENT_ICONS: Record<PlanEventType, PlanEventIconId> = {
  income: 'cash', expense: 'receipt', buyHome: 'home', haveKid: 'kid', newJob: 'briefcase',
  careerBreak: 'pause', windfall: 'gift', retire: 'beach', socialSecurity: 'shield',
};

/** Types a plan holds once. */
export const SINGLE_EVENT_TYPES: readonly PlanEventType[] = ['retire', 'socialSecurity'];

const FIRST = planDemo.years[0]!;
const LAST = planDemo.years[planDemo.years.length - 1]!;
export const FIXTURE_FIRST_YEAR = FIRST.year;
export const FIXTURE_LAST_YEAR = LAST.year;
export const FIXTURE_FIRST_AGE = FIRST.age;

/** Monthly take-home pay the placeholder plan starts from. */
const BASE_MONTHLY_INCOME = FIRST.cashFlow.income.reduce((s, l) => s + l.amount, 0) / 12;

/** The year a person of `age` is that age, in the plan's calendar. */
export const yearAtAge = (age: number): number => FIRST.year + (age - FIRST.age);

/** Yearly net worth change (today's dollars, not cumulative) of one event, per plan year index. */
function yearlyFlow(e: PlanEvent, retireYear: number): number[] {
  const flow = planDemo.years.map(() => 0);
  const add = (year: number, amount: number) => {
    const i = year - FIXTURE_FIRST_YEAR;
    if (i >= 0 && i < flow.length) flow[i] = flow[i]! + amount;
  };
  const span = (from: number, to: number, amount: number) => {
    for (let y = from; y <= to; y++) add(y, amount);
  };
  switch (e.type) {
    case 'income': span(e.year, e.endYear ?? retireYear - 1, e.monthly * 12); break;
    case 'expense':
      if (e.cadence === 'monthly') span(e.year, e.endYear ?? FIXTURE_LAST_YEAR, -e.amount * 12);
      else if (e.financing) {
        add(e.year, -e.financing.downPayment);
        const years = Math.max(1, Math.ceil(e.financing.termMonths / 12));
        span(e.year, e.year + years - 1, -(e.amount - e.financing.downPayment) / years);
      } else add(e.year, -e.amount);
      break;
    case 'buyHome': {
      // Owner costs and mortgage interest only: the down payment becomes equity in the home.
      const loan = e.payCash ? 0 : e.homeValue - e.downPayment;
      span(e.year, FIXTURE_LAST_YEAR, -(e.homeValue * (e.propertyTaxRate + e.upkeepRate) + e.insuranceMonthly.value * 12 + loan * e.rate));
      break;
    }
    case 'haveKid':
      span(e.year, e.year + e.childcareYears - 1, -e.childcareMonthly.value * 12);
      span(e.year, e.year + 17, -e.otherMonthly.value * 12);
      break;
    case 'newJob': span(e.year, retireYear - 1, (e.takeHomePay - BASE_MONTHLY_INCOME) * 12); break;
    case 'careerBreak': span(e.year, e.endYear - 1, -BASE_MONTHLY_INCOME * 12); break;
    case 'windfall': add(e.year, e.amount); break;
    case 'socialSecurity': span(e.year, FIXTURE_LAST_YEAR, e.monthly.value * 12); break;
    case 'retire': break;
  }
  return flow;
}

const cumulative = (flow: number[]): number[] => {
  let sum = 0;
  return flow.map((v) => (sum += v));
};

function retireYearOf(s: Scenario): number {
  return yearAtAge(s.assumptions.retireAge);
}

/** Net worth change per plan year of the enabled events in `events`, against nothing. */
function effectOf(events: readonly PlanEvent[], retireYear: number): number[] {
  const total = planDemo.years.map(() => 0);
  for (const e of events) {
    if (!e.enabled) continue;
    const c = cumulative(yearlyFlow(e, retireYear));
    c.forEach((v, i) => (total[i] = total[i]! + v));
  }
  return total;
}

/** The Baseline's own effect, already inside the placeholder plan. */
const BASELINE_EFFECT = effectOf(scenarioDemo.events, retireYearOf(scenarioDemo));

/** Ages at which a plan of `years` reports its KPIs. */
function kpisOf(years: PlanYear[], retireAge: number): PlanKpis {
  const at = (age: number) => years.find((y) => y.age === age) ?? years[years.length - 1]!;
  const short = years.find((y) => y.shortfall > 0);
  return {
    netWorthEndOfYear: years[0]!.netWorth,
    netWorthAtRetirement: at(retireAge).netWorth,
    retireAge,
    netWorthAtEnd: years[years.length - 1]!.netWorth,
    shortfallAge: short ? short.age : null,
  };
}

/** A placeholder PlanResult for `scenario`: the fixture plan moved by what differs from the Baseline. */
export function fixturePlan(scenario: Scenario, withoutEventId?: string): PlanResult {
  const events = withoutEventId ? scenario.events.filter((e) => e.id !== withoutEventId) : scenario.events;
  const now = effectOf(events, retireYearOf(scenario));
  const years = planDemo.years.slice(0, Math.max(1, scenario.assumptions.endAge - FIXTURE_FIRST_AGE + 1)).map((y, i): PlanYear => {
    const adj = now[i]! - BASELINE_EFFECT[i]!;
    // 'future' dollars: today's dollars grown by inflation for i years.
    const f = scenario.assumptions.display === 'future' ? (1 + scenario.assumptions.inflation) ** i : 1;
    return {
      ...y,
      netWorth: (y.netWorth + adj) * f,
      assets: (y.assets + adj) * f,
      liabilities: y.liabilities * f,
      shortfall: Math.max(0, y.shortfall - adj) * f,
      accounts: y.accounts.map((a) => ({ ...a, start: a.start * f, growth: a.growth * f, deposits: a.deposits * f, withdrawals: a.withdrawals * f, end: a.end * f })),
      cashFlow: {
        income: y.cashFlow.income.map((l) => ({ ...l, amount: l.amount * f })),
        expenses: y.cashFlow.expenses.map((l) => ({ ...l, amount: l.amount * f })),
        withdrawals: y.cashFlow.withdrawals * f,
        net: y.cashFlow.net * f,
      },
      events: events.filter((e) => e.enabled && e.year === y.year).map((e) => e.id),
    };
  });
  return {
    years,
    kpis: kpisOf(years, scenario.assumptions.retireAge),
    display: scenario.assumptions.display,
    source: 'rules',
  };
}

/** Stand-in for defaultEvent(type, ctx): the demo scenarios' own numbers and the ZIP's sources. */
export function fixtureDefaultEvent(type: PlanEventType, id: string, year: number): PlanEvent {
  const base = { id, year, enabled: true };
  const buyHome = scenarioDemo.events.find((e): e is PlanEventOf<'buyHome'> => e.type === 'buyHome')!;
  const ss = scenarioDemo.events.find((e): e is PlanEventOf<'socialSecurity'> => e.type === 'socialSecurity')!;
  const childcare = FIXTURE_AREA.childcareMonthly?.infant ?? 0;
  switch (type) {
    case 'income': return { ...base, type, monthly: 500 };
    case 'expense': return { ...base, type, amount: 5_000, cadence: 'once' };
    case 'buyHome': return { ...buyHome, ...base, type };
    case 'haveKid': return { ...base, type, childcareMonthly: { value: childcare, isEstimate: false }, childcareYears: 5, otherMonthly: { value: 850, isEstimate: true } };
    case 'newJob': return { ...base, type, takeHomePay: BASE_MONTHLY_INCOME + 1_000 };
    case 'careerBreak': return { ...base, type, endYear: year + 1 };
    case 'windfall': return { ...base, type, amount: 10_000 };
    case 'retire': return { ...base, type };
    case 'socialSecurity': return { ...base, type, year: ss.year, monthly: { ...ss.monthly } };
  }
}

/**
 * Stand-in for buyHomeBreakdown(event): the standard fixed-rate payment on the loan, plus tax and
 * insurance per month. Paying cash leaves no principal and interest.
 */
export function fixtureBuyHomeBreakdown(e: PlanEventOf<'buyHome'>): BuyHomeBreakdown {
  const loan = e.payCash ? 0 : Math.max(0, e.homeValue - e.downPayment);
  const r = e.rate / 12;
  const n = e.termYears * 12;
  const principalAndInterest = loan === 0 ? 0 : r === 0 ? loan / n : (loan * r) / (1 - (1 + r) ** -n);
  const propertyTax = (e.homeValue * e.propertyTaxRate) / 12;
  const insurance = e.insuranceMonthly.value;
  return { principalAndInterest, propertyTax, insurance, total: principalAndInterest + propertyTax + insurance };
}

/** Account name and group for a plan row; event-made accounts ('ev-buy-home:home') borrow the event's name. */
export function accountLabel(id: string, events: readonly PlanEvent[]): { name: string; group: Account['group'] } | null {
  const a = accountsDemo.find((x) => x.id === id);
  if (a) return { name: a.name, group: a.group };
  const [eventId, part] = id.split(':');
  const e = events.find((x) => x.id === eventId);
  if (!e) return null;
  if (part === 'home') return { name: e.name ?? 'Home', group: 'realEstate' };
  if (part === 'mortgage') return { name: e.name ? `${e.name} mortgage` : 'Mortgage', group: 'mortgage' };
  return { name: e.name ?? id, group: 'otherAsset' };
}
