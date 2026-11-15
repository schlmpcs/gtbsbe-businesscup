// Home "Life line" hero: one decision (when to buy a home) dragged along the years, and the whole plan to
// the end age redrawn for the year picked. Every number is the engine's:
// - the two lines and the KPIs are plan() of the active /plan scenario with "Buy a home" at the picked
//   year and at the plan's year (eventAtYear), on the same inputs /plan uses (planInputs.ts);
// - Chance of success and the p10–p90 band come from decisionSweep() in the Monte Carlo Web Worker, one
//   fixed seed for every year so a change between two years is the decision's, not noise.
// A plan without "Buy a home" gets the engine's default one (defaultEvent: the area's median home, its
// tax and insurance), three years from now, as a draft: "Put it in my plan" adds it to the scenario.
// Rounding and wording happen here (copy.lifeline); the UI only lays the numbers out.
import { buyHomeBreakdown, defaultEvent, eventAtYear, plan } from '@lifeguessr/engine';
import type { DecisionSweepPoint, PlanEventOf, PlanResult, Scenario } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { lifeline as copy } from '@/copy';
import { formatMoney, formatRate } from '@/lib/format';
import { startMonteCarloJob } from '@/features/plan/model/monteCarloJob';
import { calendarOf, usePlanInputs, type PlanInputs } from '@/features/plan/model/planInputs';
import { DEFAULT_CHANCE_SETTINGS, usePlanStore } from '@/features/plan/model/planStore';
import { GOOD_SUCCESS_RATE } from '@/features/plan/model/useChanceOfSuccess';
import type { LifeLineChartVM, LifeLineKpiVM, LifeLinePoint, LifeLineTone, LifeLineVM } from './types';

/** Paths per year of the sweep: enough for a steady percentage, light enough for ~1 s on a phone. */
export const LIFELINE_PATHS = 500;
/** Id of the draft "Buy a home" when the plan has none, and how many years from now it starts. */
export const DRAFT_EVENT_ID = 'lifeline-buy-home';
export const DRAFT_YEARS_AHEAD = 3;
/** Slider span around the plan's year (calendar years). */
export const SPAN_BEFORE = 4;
export const SPAN_AFTER = 8;
/** A change of less than this in the chance of success is not worth a headline. */
const CHANCE_HEADLINE_MIN = 0.05;

type Chance = NonNullable<DecisionSweepPoint['chance']>;
export type HomeDecision = { scenario: Scenario; eventId: string; inPlan: boolean; event: PlanEventOf<'buyHome'> };

/** The active scenario's first enabled "Buy a home", or the default one as a draft three years out. */
export function homeDecision(inputs: PlanInputs, scenario: Scenario): HomeDecision {
  const own = scenario.events.find((e): e is PlanEventOf<'buyHome'> => e.type === 'buyHome' && e.enabled);
  if (own) return { scenario, eventId: own.id, inPlan: true, event: own };
  const asOf = inputs.profile.asOf!;
  const ctx = { profile: inputs.profile, assumptions: scenario.assumptions, asOf, ...(inputs.area ? { area: inputs.area } : {}) };
  const event = { ...defaultEvent('buyHome', ctx), id: DRAFT_EVENT_ID, year: Number(asOf.slice(0, 4)) + DRAFT_YEARS_AHEAD };
  return { scenario: { ...scenario, events: [...scenario.events, event] }, eventId: DRAFT_EVENT_ID, inPlan: false, event };
}

/** The slider's calendar years: the plan's year − SPAN_BEFORE … + SPAN_AFTER, from next year to the year before retiring. */
export function sweepYears(baseYear: number, asOfYear: number, retireYear: number): number[] {
  const min = Math.min(baseYear, Math.max(asOfYear + 1, baseYear - SPAN_BEFORE));
  const max = Math.max(baseYear, Math.min(retireYear - 1, baseYear + SPAN_AFTER));
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

const compact = (v: number) => formatMoney(v, { compact: true });
const signedCompact = (v: number) => formatMoney(v, { compact: true, signed: true });
const pct = (r: number) => formatRate(r, 0);
const tone = (v: number): LifeLineTone => (v > 0 ? 'good' : v < 0 ? 'bad' : 'neutral');

/** 1, 2 or 5 × 10^k: a step that splits `span` into about four parts. */
export function niceStep(span: number): number {
  if (!(span > 0)) return 1;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

const pointsOf = (r: PlanResult): LifeLinePoint[] => r.years.map((y) => ({ age: y.age, netWorth: y.netWorth }));
const netWorthAt = (r: PlanResult, age: number) => r.years.find((y) => y.age === age)?.netWorth ?? r.years.at(-1)!.netWorth;

/** Everything the hero shows for the event at `selectedYear` vs the plan's year. Pure (exported for tests). */
export function lifeLineData(args: {
  decision: HomeDecision;
  inputs: PlanInputs;
  selectedYear: number;
  plans: { selected: PlanResult; base: PlanResult };
  chance: { selected: Chance; base: Chance } | 'measuring' | 'error';
  years: number[];
}): Omit<Extract<LifeLineVM, { status: 'ready' }>, 'setAge' | 'applyToPlan'> {
  const { decision, inputs, selectedYear, plans, chance, years } = args;
  const { selected: sel, base } = plans;
  const cal = calendarOf(inputs.profile);
  const ageOf = (year: number) => year - cal.birthYear;
  const baseYear = decision.event.year;
  const moved = selectedYear !== baseYear;
  const selAge = ageOf(selectedYear);
  const baseAge = ageOf(baseYear);
  const endAge = decision.scenario.assumptions.endAge;
  const measured = typeof chance === 'object' ? chance : null;

  // ----- KPIs
  const retireAge = sel.kpis.retireAge;
  const nwDiff = sel.kpis.netWorthAtRetirement - base.kpis.netWorthAtRetirement;
  const atRetirement: LifeLineKpiVM = {
    id: 'atRetirement',
    label: copy.kpi.atRetirement(retireAge),
    value: compact(sel.kpis.netWorthAtRetirement),
    was: moved ? compact(base.kpis.netWorthAtRetirement) : null,
    delta: moved && compact(nwDiff) !== compact(0) ? `${nwDiff > 0 ? '▲' : '▼'} ${compact(Math.abs(nwDiff))}` : null,
    tone: moved ? tone(nwDiff) : 'neutral',
  };
  const chanceDiff = measured ? measured.selected.successRate - measured.base.successRate : 0;
  const chancePts = Math.round(chanceDiff * 100);
  const chanceKpi: LifeLineKpiVM = {
    id: 'chance',
    label: copy.kpi.chance,
    value: measured ? pct(measured.selected.successRate) : null,
    was: measured && moved ? pct(measured.base.successRate) : null,
    delta: measured && moved && chancePts !== 0 ? copy.kpi.pts(`${chancePts > 0 ? '▲ +' : '▼ −'}${Math.abs(chancePts)}`) : null,
    tone: measured ? (moved ? tone(chancePts) : measured.selected.successRate >= GOOD_SUCCESS_RATE ? 'good' : 'bad') : 'neutral',
    gaugePct: measured ? Math.round(measured.selected.successRate * 100) : null,
    note: chance === 'measuring' ? copy.kpi.measuring : chance === 'error' ? copy.kpi.unavailable : null,
  };
  const runsOutLabel = (age: number | null) => (age === null ? copy.kpi.never : copy.kpi.atAge(age));
  const selShort = sel.kpis.shortfallAge;
  const baseShort = base.kpis.shortfallAge;
  const runsOut: LifeLineKpiVM = {
    id: 'runsOut',
    label: copy.kpi.runsOut,
    value: runsOutLabel(selShort),
    was: moved && selShort !== baseShort ? runsOutLabel(baseShort) : null,
    delta: !moved || selShort === baseShort ? null : selShort === null ? copy.kpi.fixed : baseShort === null ? copy.kpi.broken : null,
    tone: selShort === null ? 'good' : 'bad',
  };

  // ----- Headline
  const lead = !moved ? copy.lead.same : selectedYear > baseYear ? copy.lead.later(selectedYear - baseYear) : copy.lead.sooner(baseYear - selectedYear);
  let payoff: string | null = null;
  let payoffTone: LifeLineTone = 'neutral';
  if (moved) {
    if (measured && Math.abs(chanceDiff) >= CHANCE_HEADLINE_MIN) {
      payoff = copy.payoff.chance(pct(measured.base.successRate), pct(measured.selected.successRate));
      payoffTone = tone(chanceDiff);
    } else if (selShort !== baseShort && (selShort === null || baseShort === null)) {
      payoff = selShort === null ? copy.payoff.lasts(endAge) : copy.payoff.runsOut(selShort);
      payoffTone = selShort === null ? 'good' : 'bad';
    } else if (compact(nwDiff) !== compact(0)) {
      payoff = copy.payoff.atRetirement(signedCompact(nwDiff));
      payoffTone = tone(nwDiff);
    }
  }

  // ----- Chart
  const selected = pointsOf(sel);
  const before = moved ? pointsOf(base) : null;
  const ages = selected.map((p) => p.age);
  const band = measured
    ? measured.selected.bands.map((b) => ({ age: ageOf(b.year), p10: b.p10, p90: b.p90 }))
    : null;
  const values = [
    ...selected.map((p) => p.netWorth),
    ...(before ?? []).map((p) => p.netWorth),
    ...(band ?? []).flatMap((b) => [b.p10, b.p90]),
    0,
  ];
  const step = niceStep(Math.max(...values) - Math.min(...values));
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step;
  const yTicks: LifeLineChartVM['yTicks'] = [];
  for (let v = lo; v <= hi + step / 2; v += step) yTicks.push({ value: v, label: compact(v) });
  const firstAge = ages[0]!;
  const lastAge = ages.at(-1)!;
  const xTicks = ages.filter((a) => a === firstAge || a === lastAge || a % 5 === 0).map((age) => ({ age, label: String(age) }));

  const selEvents = eventAtYear(decision.scenario, decision.eventId, selectedYear).events.filter((e) => e.enabled);
  const markers: LifeLineChartVM['markers'] = [];
  for (const e of selEvents) {
    if (e.type === 'buyHome' && e.id === decision.eventId) markers.push({ id: e.id, age: selAge, label: copy.chart.marker.home, icon: 'home', tone: 'primary' });
    else if (e.type === 'haveKid') markers.push({ id: e.id, age: ageOf(e.year), label: copy.chart.marker.kid, icon: 'kid', tone: 'violet' });
  }
  markers.push({ id: 'retire', age: retireAge, label: copy.chart.marker.retire, icon: 'beach', tone: 'positive' });

  const shortLine = before && baseShort !== null ? { age: baseShort, line: 'before' as const } : selShort !== null ? { age: selShort, line: 'selected' as const } : null;
  const chart: LifeLineChartVM = {
    title: copy.chart.title(endAge),
    ariaLabel: copy.chart.ariaLabel,
    selected,
    before,
    band,
    ageDomain: [firstAge, lastAge],
    valueDomain: [lo, hi],
    xTicks,
    yTicks,
    markers: markers.filter((m) => m.age >= firstAge && m.age <= lastAge),
    retireCallout: { age: retireAge, netWorth: netWorthAt(sel, retireAge), label: copy.chart.atRetirement(compact(netWorthAt(sel, retireAge)), retireAge) },
    beforeCallout: before ? { age: retireAge, netWorth: netWorthAt(base, retireAge), label: copy.chart.was(compact(netWorthAt(base, retireAge))) } : null,
    runsOut: shortLine ? { ...shortLine, label: copy.chart.runsOut(shortLine.age) } : null,
    dragged: moved ? { fromAge: baseAge, toAge: selAge } : null,
    legend: {
      selected: copy.chart.selected(selAge),
      before: moved ? copy.chart.before(baseAge) : null,
      band: copy.chart.band(LIFELINE_PATHS.toLocaleString('en-US')),
    },
  };

  // ----- Slider
  const ev = eventAtYear(decision.scenario, decision.eventId, selectedYear).events.find((e) => e.id === decision.eventId) as PlanEventOf<'buyHome'>;
  const monthly = buyHomeBreakdown(ev).total;
  const downShare = ev.homeValue > 0 ? ev.downPayment / ev.homeValue : 0;
  const slider = {
    eyebrow: copy.slider.eyebrow(inputs.area?.metro ?? null),
    title: copy.slider.title(selAge),
    titleNot: moved ? copy.slider.titleNot(baseAge) : null,
    label: copy.slider.label,
    min: ageOf(years[0]!),
    max: ageOf(years.at(-1)!),
    value: selAge,
    base: baseAge,
    ticks: years.map(ageOf),
    formatValue: copy.slider.value,
    facts: [
      { label: copy.slider.homePrice(formatMoney(ev.homeValue)), tone: 'plain' as const },
      { label: copy.slider.downPayment(formatMoney(ev.downPayment), pct(downShare)), tone: 'plain' as const },
      { label: copy.slider.payment(formatMoney(monthly)), tone: 'plain' as const },
    ],
    isEstimate: ev.insuranceMonthly.isEstimate,
    estimateNote: copy.slider.estimate,
  };

  const onTrack = measured ? measured.selected.successRate >= GOOD_SUCCESS_RATE : selShort === null;
  return {
    status: 'ready',
    sticker: copy.sticker,
    headline: { lead, payoff, payoffTone },
    sub: copy.sub(LIFELINE_PATHS.toLocaleString('en-US'), endAge),
    kpis: [atRetirement, chanceKpi, runsOut],
    chart,
    slider,
    house: onTrack
      ? { art: 'home-large', label: copy.house.built, tone: 'good' }
      : { art: 'house-build', label: copy.house.building, tone: 'bad' },
    apply: { label: !moved && decision.inPlan ? copy.apply.done : copy.apply.cta(selAge), done: !moved && decision.inPlan },
    disclaimer: copy.disclaimer,
  };
}

// plan() per year, computed once per (inputs, decision) (a drag back to a year reuses it). Both are immutable.
const planCache = new WeakMap<PlanInputs, WeakMap<HomeDecision, Map<number, PlanResult>>>();
function planAtYear(inputs: PlanInputs, decision: HomeDecision, year: number): PlanResult {
  let byDecision = planCache.get(inputs);
  if (!byDecision) planCache.set(inputs, (byDecision = new WeakMap()));
  let byYear = byDecision.get(decision);
  if (!byYear) byDecision.set(decision, (byYear = new Map()));
  let r = byYear.get(year);
  if (!r) byYear.set(year, (r = plan(inputs.profile, inputs.accounts, eventAtYear(decision.scenario, decision.eventId, year), inputs.area)));
  return r;
}

type SweepState = { of: HomeDecision; inputs: PlanInputs; result: Map<number, Chance> | 'error' };

export function useLifeLine(): LifeLineVM {
  const inputs = usePlanInputs();
  const ready = usePlanStore((s) => s.ready);
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const fixedSeed = usePlanStore((s) => s.fixedSeed);
  const edit = usePlanStore((s) => s.edit);
  const [picked, setPicked] = useState<number | null>(null);
  const [sweep, setSweep] = useState<SweepState | null>(null);

  const decision = useMemo(() => (ready && scenario && inputs.profile.asOf ? homeDecision(inputs, scenario) : null), [ready, scenario, inputs]);
  const years = useMemo(() => {
    if (!decision) return [];
    const cal = calendarOf(inputs.profile);
    return sweepYears(decision.event.year, cal.asOfYear, cal.birthYear + decision.scenario.assumptions.retireAge);
  }, [decision, inputs.profile]);

  // The Chance of success at every slider year, in the worker. A new plan or new inputs restart it.
  useEffect(() => {
    if (!decision || years.length === 0) return;
    const settings = { ...DEFAULT_CHANCE_SETTINGS, paths: LIFELINE_PATHS, seed: fixedSeed };
    return startMonteCarloJob(
      { kind: 'decisionSweep', inputs, scenario: decision.scenario, eventId: decision.eventId, years, settings },
      (res) => setSweep({
        of: decision,
        inputs,
        result: res.kind === 'decisionSweep' ? new Map(res.points.map((p) => [p.year, p.chance])) : 'error',
      }),
    );
  }, [decision, years, inputs, fixedSeed]);

  const baseYear = decision?.event.year ?? 0;
  const selectedYear = picked !== null && years.includes(picked) ? picked : baseYear;

  const setAge = useCallback(
    (age: number) => {
      if (!decision) return;
      const cal = calendarOf(inputs.profile);
      setPicked(age + cal.birthYear);
    },
    [decision, inputs.profile],
  );

  const applyToPlan = useCallback(() => {
    if (!decision || !scenario) return;
    if (decision.inPlan) {
      edit(scenario.id, (s) => eventAtYear(s, decision.eventId, selectedYear));
    } else {
      edit(scenario.id, (s) => ({ ...s, events: [...s.events, { ...decision.event, year: selectedYear }] }));
    }
    setPicked(null);
  }, [decision, scenario, edit, selectedYear]);

  return useMemo((): LifeLineVM => {
    if (!decision) return { status: 'loading' };
    const selected = planAtYear(inputs, decision, selectedYear);
    const base = planAtYear(inputs, decision, baseYear);
    const current = sweep && sweep.of === decision && sweep.inputs === inputs ? sweep.result : null;
    const chance =
      current === null ? 'measuring' as const
        : current === 'error' ? 'error' as const
          : current.has(selectedYear) && current.has(baseYear)
            ? { selected: current.get(selectedYear)!, base: current.get(baseYear)! }
            : 'error' as const;
    return {
      ...lifeLineData({ decision, inputs, selectedYear, plans: { selected, base }, chance, years }),
      setAge,
      applyToPlan,
    };
  }, [decision, selectedYear, baseYear, sweep, inputs, years, setAge, applyToPlan]);
}
