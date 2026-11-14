// Pure builders for the What if? view-models: scenarios → engine compareFutures → chart, cards and
// result data. No React here, so the hooks and their tests share one path.
import { amortizedPayment, compareFutures } from '@lifeguessr/engine';
import { findArea, getArea } from '@lifeguessr/data/areas';
import type { FutureComparison, FutureSide, Goal, Profile, Scenario, ScenarioChange } from '@lifeguessr/types';
import { whatIf as t } from '@/copy';
import { resolveWhatIfPreset, whatIfPresets, type WhatIfPreset } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import type { ChartVM, ChoiceFactVM, ChoiceVM, ConfirmVM, Letter, ResultVM } from './types';

/** Where costs come from when the profile has no ZIP we know: the demo life's metro (said on screen). */
export const FALLBACK_HOME_ZIP = '75206';

export const PRESETS: readonly WhatIfPreset[] = whatIfPresets;

export function homeAreaOf(p: Pick<Profile, 'zip'>) {
  const known = findArea(p.zip);
  return { area: known ?? getArea(FALLBACK_HOME_ZIP), assumed: known === null };
}

/** A side of the comparison: the scenario, its title and art. */
export type Side = { scenario: Scenario; title: string; art: string | null; presetId: string | null; estimate: boolean };

export function presetSides(preset: WhatIfPreset, p: Pick<Profile, 'zip'>): { A: Side; B: Side } {
  const home = homeAreaOf(p).area;
  const side = (letter: Letter): Side => ({
    scenario: resolveWhatIfPreset(preset[letter], home),
    title: t.sideTitles[preset.id]?.[letter] ?? preset[letter].label,
    art: preset[letter].art,
    presetId: preset.id,
    estimate: preset.isEstimate,
  });
  return { A: side('A'), B: side('B') };
}

export function compare(p: Profile, A: Scenario, B: Scenario, goal: Goal | null): FutureComparison {
  return compareFutures(p, A, B, {
    areaOf: findArea,
    homeArea: homeAreaOf(p).area,
    rates: areaRates(p),
    goal,
  });
}

const purchaseOf = (c: Extract<ScenarioChange, { kind: 'purchase' | 'loan' }>) =>
  c.kind === 'purchase' ? c.purchase : { label: c.label ?? 'loan', amount: c.loan.amount, recurring: false as const, payWith: { loan: c.loan } };

/** The fact chips one change shows. `areaZip` = the ZIP the scenario ends in (for childcare). */
export function changeFacts(c: ScenarioChange, p: Profile, areaZip: string | undefined): ChoiceFactVM[] {
  switch (c.kind) {
    case 'purchase':
    case 'loan': {
      const x = purchaseOf(c);
      const facts: ChoiceFactVM[] = [];
      if (x.recurring !== false && typeof x.payWith !== 'object') facts.push({ kind: 'recurring', amount: x.amount, per: x.recurring });
      else facts.push({ kind: 'price', amount: x.amount });
      if (typeof x.payWith === 'object') {
        const l = x.payWith.loan;
        const principal = Math.max(0, l.amount - (l.downPayment ?? 0)) + (l.fees ?? 0);
        facts.push({ kind: 'loan', apr: l.apr, termMonths: l.termMonths, monthly: principal > 0 ? amortizedPayment(principal, l.apr, l.termMonths) : 0 });
        if (l.downPayment) facts.push({ kind: 'down', amount: l.downPayment });
      } else {
        facts.push({ kind: 'payWith', way: x.payWith });
      }
      return facts;
    }
    case 'move': {
      const a = getArea(c.zip);
      return [{ kind: 'place', metro: a.metro, tier: a.tier, zip: a.zip }];
    }
    case 'kid': {
      const area = findArea(areaZip) ?? homeAreaOf(p).area;
      return [{ kind: 'kid', age: c.age, inMonths: c.inMonths ?? 0, childcare: area.childcareMonthly?.[c.age] ?? null }];
    }
    case 'income':
      return [{ kind: 'income', monthlyDelta: c.monthlyDelta, grossYearly: c.grossYearly ?? null }];
    case 'rent':
      return [{ kind: 'rent', monthly: c.monthly }];
    case 'payDebt': {
      const d = p.debts.find((x) => x.kind === c.debtKind && x.balance > 0);
      // The same cap the engine applies: no more than the balance or the cash on hand.
      return [{ kind: 'payDebt', amount: d ? Math.min(c.amount ?? Number.POSITIVE_INFINITY, d.balance, Math.max(0, p.cash.value)) : null }];
    }
  }
}

function endZip(s: Scenario, p: Profile): string | undefined {
  let zip = p.zip;
  for (const c of s.changes) if (c.kind === 'move') zip = c.zip;
  return zip;
}

export function choiceVM(letter: Letter, side: Side, p: Profile, future: FutureSide | null): ChoiceVM {
  const zip = endZip(side.scenario, p);
  const facts: ChoiceFactVM[] = side.scenario.changes.flatMap((c) => changeFacts(c, p, zip));
  if (side.scenario.changes.length === 0) facts.push(side.presetId === 'card' ? { kind: 'keep' } : { kind: 'asItIs' });
  for (const a of future?.afford ?? []) facts.push({ kind: 'afford', verdict: a.verdict, waitMonths: a.waitMonths ?? null });
  return { letter, title: side.title, art: side.art, facts: facts.slice(0, 4), estimate: side.estimate };
}

/** A title for a scenario the user built from typed changes. */
export function customTitle(changes: readonly ScenarioChange[], base: string): string {
  const last = changes[changes.length - 1];
  if (!last) return base;
  const name = (c: ScenarioChange): string => {
    switch (c.kind) {
      case 'purchase': return c.purchase.label;
      case 'loan': return c.label ?? t.changeKinds.loan;
      case 'move': return t.facts.place(getArea(c.zip).metro, getArea(c.zip).tier).split(' · ')[0]!;
      case 'kid': return t.facts.kid(c.age, c.inMonths ?? 0);
      case 'income': return t.changeKinds.income;
      case 'rent': return t.changeKinds.rent;
      case 'payDebt': return t.changeKinds.payDebt;
    }
  };
  return base ? `${base} + ${name(last)}` : name(last);
}

/** 3–5 round tick values covering [min, max]. Display scaling only. */
function niceTicks(min: number, max: number): { ticks: number[]; min: number; max: number } {
  const span = Math.max(1, max - min);
  const raw = span / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return { ticks, min: lo, max: hi };
}

export function chartVM(cmp: FutureComparison, A: Scenario, B: Scenario, goal: Goal | null): ChartVM {
  const sideOf = (letter: Letter, f: FutureSide) => ({
    letter,
    points: f.points,
    yearly: f.yearly,
    end: f.end,
    verdict: f.goal?.verdict ?? null,
  });
  const values = [...cmp.A.points, ...cmp.B.points].flatMap((x) => [x.low, x.high]);
  const showGoal = goal !== null && goal.years <= cmp.years;
  if (showGoal) values.push(goal.target);
  values.push(0);
  const { ticks, min, max } = niceTicks(Math.min(...values), Math.max(...values));
  const horizon = cmp.years * 12;
  const markers: ChartVM['markers'] = [];
  for (const [letter, s] of [['A', A], ['B', B]] as const) {
    for (const c of s.changes) {
      const m = 'inMonths' in c ? (c.inMonths ?? 0) : 0;
      if (m > 0 && m < horizon && !markers.some((x) => x.letter === letter && x.month === m)) markers.push({ letter, month: m });
    }
  }
  return {
    years: cmp.years,
    A: sideOf('A', cmp.A),
    B: sideOf('B', cmp.B),
    domain: { min, max },
    ticks,
    goal: showGoal ? { target: goal.target, years: goal.years } : null,
    markers,
    key: `${Math.round(cmp.A.end.mid)}:${Math.round(cmp.B.end.mid)}`,
  };
}

export function resultVM(cmp: FutureComparison, thisYear: number): ResultVM {
  const winner: Letter | null = Math.abs(cmp.diff) < 0.5 ? null : cmp.diff > 0 ? 'B' : 'A';
  const terms = new Set([...cmp.A.monthly.map((m) => m.term), ...cmp.B.monthly.map((m) => m.term)]);
  const bars = [...terms].map((term) => ({
    term,
    A: cmp.A.monthly.find((m) => m.term === term)?.delta ?? 0,
    B: cmp.B.monthly.find((m) => m.term === term)?.delta ?? 0,
  })).filter((b) => Math.abs(b.A) >= 0.5 || Math.abs(b.B) >= 0.5)
    .sort((x, y) => Math.max(Math.abs(y.A), Math.abs(y.B)) - Math.max(Math.abs(x.A), Math.abs(x.B)));
  return {
    winner,
    aheadBy: Math.abs(cmp.diff),
    endYear: thisYear + cmp.years,
    decidedBy: cmp.decidedBy && winner ? { term: cmp.decidedBy.term, winner, gap: Math.abs(cmp.decidedBy.gap) } : null,
    bars,
    barAxis: bars.some((b) => b.A < 0 || b.B < 0) ? 'center' : 'left',
    barMax: Math.max(1, ...bars.flatMap((b) => [Math.abs(b.A), Math.abs(b.B)])),
  };
}

export function confirmVM(change: ScenarioChange, inferred: string[], parsedBy: 'ai' | 'rules', p: Profile): ConfirmVM {
  const place = change.kind === 'move' && inferred.includes('zip')
    ? (() => {
      const a = getArea(change.zip);
      return { metro: a.metro, zip: a.zip, tier: a.tier };
    })()
    : null;
  return {
    kind: change.kind,
    facts: changeFacts(change, p, change.kind === 'move' ? change.zip : p.zip),
    place,
    raise: change.kind === 'income' && change.grossYearly !== undefined
      ? { grossYearly: change.grossYearly, monthlyDelta: change.monthlyDelta }
      : null,
    noTiming: inferred.includes('inMonths'),
    inferred,
    parsedBy,
  };
}
