// The /plan hooks' bridge to the engine (MP7b): the person's real inputs (the profile store, stamped
// with this month; the accounts store; the area data of the profile's ZIP), the plan calendar, and one
// memoized plan() per (inputs, scenario, applied moves). Every number on /plan comes from plan() here
// (packages/engine/plan.ts): KPIs, the chart, the tables, Compare, the event preview and the moves'
// effects. Nothing is invented in the web app.
//
// Before the person has entered anything the profile store holds the demo profile (the app shows the
// sample banner then), so /plan always has a plan to show.
import { findArea } from '@lifeguessr/data/areas';
import { accountsToProfile, applyPatch, plan } from '@lifeguessr/engine';
import type {
  Account, AccountGroup, AreaData, Move, PlanEventContext, PlanEventType, PlanResult, Profile, Scenario,
} from '@lifeguessr/types';
import { useMemo } from 'react';
import { plan as copy } from '@/copy';
import { useAccountsReady, useAccountsStore } from '@/lib/model/accounts';
import { useProfile } from '@/state/profile';
import type { PlanEventIconId } from './types';

/** What every plan on the screen is computed from. One object per change, so it keys the memo. */
export type PlanInputs = {
  /** The stored profile stamped with this month (`asOf`). */
  profile: Profile;
  /** The person's accounts; empty until the store has loaded (plan() then reads the profile's own balances). */
  accounts: readonly Account[];
  /** Area data of the profile's ZIP, when we cover it. */
  area: AreaData | undefined;
};

export function makePlanInputs(profile: Profile, accounts: readonly Account[]): PlanInputs {
  const area = findArea(profile.zip) ?? undefined;
  return { profile, accounts, area };
}

/** The plan inputs from the stores, memoized on the profile and the accounts. */
export function usePlanInputs(): PlanInputs {
  const profile = useProfile();
  const ready = useAccountsReady();
  const stored = useAccountsStore((s) => s.accounts);
  const accounts = ready ? stored : NO_ACCOUNTS;
  return useMemo(() => makePlanInputs(profile, accounts), [profile, accounts]);
}
const NO_ACCOUNTS: readonly Account[] = [];

// ----- Calendar ------------------------------------------------------------------------------------

/** The plan's years: this calendar year (age today) to the year the person turns `endAge`. Same rule as plan(). */
export type PlanCalendar = { firstYear: number; firstAge: number; birthYear: number; lastYear: number };

export function calendarOf(profile: Profile, endAge: number): PlanCalendar {
  const firstYear = Number((profile.asOf ?? '').slice(0, 4));
  const firstAge = Math.round(profile.age.value);
  const birthYear = firstYear - firstAge;
  return { firstYear, firstAge, birthYear, lastYear: Math.max(firstYear, birthYear + endAge) };
}

export const ageAt = (cal: PlanCalendar, year: number): number => year - cal.birthYear;
export const yearAt = (cal: PlanCalendar, age: number): number => cal.birthYear + age;
/** Clamp to the plan's calendar and round to a whole year. */
export const clampYearTo = (cal: PlanCalendar, year: number): number =>
  Math.min(cal.lastYear, Math.max(cal.firstYear, Math.round(year)));

/** The context defaultEvent / defaultEventSources / expandEvent read. */
export function eventContext(inputs: PlanInputs, scenario: Scenario): PlanEventContext {
  const profile = profileFor(inputs, NO_MOVES);
  return { profile, assumptions: scenario.assumptions, asOf: profile.asOf!, ...(inputs.area && { area: inputs.area }) };
}

// ----- Profile with moves and the memoized plan ----------------------------------------------------

export const NO_MOVES: readonly Move[] = [];

/**
 * The profile a scenario is planned on: the accounts folded in with the engine's accountsToProfile (so a
 * move's debt id matches the accounts'), then each applied move's patch in order.
 */
export function profileFor(inputs: PlanInputs, moves: readonly Move[]): Profile {
  const { profile, accounts } = inputs;
  // plan() folds investments in as their own group; here they stay out, as plan() does.
  let p = accounts.length > 0 ? accountsToProfile(accounts.filter((a) => a.group !== 'investments'), profile) : profile;
  for (const m of moves) p = applyPatch(p, m.patch);
  return p;
}

const cache = new WeakMap<PlanInputs, WeakMap<Scenario, WeakMap<readonly Move[], PlanResult>>>();

/**
 * plan() of `scenario` on the inputs with `moves` applied. Memoized on the three objects (the stores
 * replace them on every change), so the hooks share one run per edit.
 */
export function planOf(inputs: PlanInputs, scenario: Scenario, moves: readonly Move[] = NO_MOVES): PlanResult {
  let byScenario = cache.get(inputs);
  if (!byScenario) cache.set(inputs, (byScenario = new WeakMap()));
  let byMoves = byScenario.get(scenario);
  if (!byMoves) byScenario.set(scenario, (byMoves = new WeakMap()));
  let result = byMoves.get(moves);
  if (!result) {
    result = plan(profileFor(inputs, moves), inputs.accounts, scenario, inputs.area);
    byMoves.set(moves, result);
  }
  return result;
}

// ----- Labels --------------------------------------------------------------------------------------

export const EVENT_ICONS: Record<PlanEventType, PlanEventIconId> = {
  income: 'cash', expense: 'receipt', buyHome: 'home', haveKid: 'kid', newJob: 'briefcase',
  careerBreak: 'pause', windfall: 'gift', retire: 'beach', socialSecurity: 'shield',
};

/** Types a plan holds once. */
export const SINGLE_EVENT_TYPES: readonly PlanEventType[] = ['retire', 'socialSecurity'];

const DEBT_GROUP: Record<string, AccountGroup> = { card: 'creditCard', mortgage: 'mortgage' };

/**
 * Name and group of a plan account row (PlanAccountRow.accountId, see plan.ts step 4): one of the
 * person's accounts, a debt of the profile (no accounts loaded), an event's home / mortgage / loan
 * (`<eventId>:home`), or a group with no account (`group:<group>`).
 */
export function accountLabel(
  id: string, inputs: PlanInputs, scenario: Scenario,
): { name: string; group: AccountGroup } {
  const a = inputs.accounts.find((x) => x.id === id);
  if (a) return { name: a.name, group: a.group };
  if (id.startsWith('group:')) {
    const group = id.slice('group:'.length) as AccountGroup;
    return { name: copy.groups[group] ?? group, group };
  }
  const debt = inputs.profile.debts.find((d) => d.id === id);
  if (debt) return { name: copy.debtKinds[debt.kind], group: DEBT_GROUP[debt.kind] ?? 'loan' };
  const cut = id.lastIndexOf(':');
  const eventId = cut > 0 ? id.slice(0, cut) : id;
  const part = cut > 0 ? id.slice(cut + 1) : '';
  const e = scenario.events.find((x) => x.id === eventId);
  const title = e ? (e.name ?? copy.events[e.type].title) : id;
  if (part === 'home') return { name: e?.name ?? copy.accountRows.home, group: 'realEstate' };
  if (part === 'mortgage') return { name: copy.accountRows.mortgage(e?.name), group: 'mortgage' };
  if (part === 'loan') return { name: copy.accountRows.loan(title), group: 'loan' };
  return { name: title, group: 'otherAsset' };
}
