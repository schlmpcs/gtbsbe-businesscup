// The event panel: an event's fields with their sources and estimate tags, the monthly breakdown of a
// home purchase (buyHomeBreakdown, MP4) or of a financed expense (expenseFinancingBreakdown), the down
// payment as $ and % (kept in sync), and the with-vs-without preview (previewEvent, MP6).
//
// Down payment sync (plain arithmetic, the engine is not involved): dollars = pct × price and
// pct = dollars ÷ price. Dollars are the stored field, so a new price keeps the dollars and moves the %.
import {
  buyHomeBreakdown, defaultEventSources, expenseFinancingBreakdown, previewEvent, type DefaultEventSources,
} from '@lifeguessr/engine';
import type { PlanEvent, PlanEventOf, Scenario } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { track } from '@/lib/events';
import { iconOf, money, pct, shortfallLabel, shortfallYearsDelta, signedMoney, toneOf } from './planFormat';
import { calendarOf, planFor, usePlanInputs, yearRangeOf, type PlanInputs } from './planInputs';
import { usePlanStore } from './planStore';
import { eventContextOf } from './useEventCatalog';
import { clampYear, movedEvent, withEventYear } from './usePlan';
import type {
  EventBreakdownVM, EventEditorVM, EventFieldVM, EventFinancingVM, EventPreviewVM, PlanFieldValue,
} from './types';

type YearRange = { min: number; max: number };
type FieldSpec = Omit<EventFieldVM, 'display' | 'label' | 'isEstimate'> & { display?: string; isEstimate?: boolean };

const moneyField = (key: string, value: number, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, kind: 'money', value, min: 0, ...extra });
const rateField = (key: string, value: number, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, kind: 'rate', value, min: 0, max: 1, ...extra });

/**
 * The event's fields. `sources` (defaultEventSources) says where each default came from: the area's
 * data (ACS home value and tax rate, NAIC insurance, DOL childcare) or one of the engine's assumptions.
 */
function specsOf(e: PlanEvent, range: YearRange, sources: DefaultEventSources): FieldSpec[] {
  const h = copy.editor.hints;
  const src = (key: string): Partial<FieldSpec> => (sources[key] ? { source: sources[key] } : {});
  const yearField: FieldSpec = { key: 'year', kind: 'year', value: e.year, min: range.min, max: range.max, ...src('year') };
  const endYearField = (value: number): FieldSpec => ({ key: 'endYear', kind: 'year', value, min: range.min, max: range.max, ...src('endYear') });
  switch (e.type) {
    case 'income': return [yearField, moneyField('monthly', e.monthly, src('monthly')), ...(e.endYear !== undefined ? [endYearField(e.endYear)] : [])];
    case 'expense':
      return [
        yearField,
        moneyField('amount', e.amount, src('amount')),
        { key: 'cadence', kind: 'choice', value: e.cadence, options: [{ value: 'once', label: copy.editor.cadence.once }, { value: 'monthly', label: copy.editor.cadence.monthly }] },
        ...(e.endYear !== undefined ? [endYearField(e.endYear)] : []),
        ...(e.financing
          ? [
              moneyField('financingDownPayment', e.financing.downPayment),
              rateField('financingApr', e.financing.apr, { max: 1 }),
              { key: 'financingTermMonths', kind: 'count' as const, value: e.financing.termMonths, min: 1, max: 600 },
            ]
          : []),
      ];
    case 'buyHome':
      return [
        yearField,
        moneyField('homeValue', e.homeValue, src('homeValue')),
        moneyField('downPayment', e.downPayment, { hint: h.downPayment, ...src('downPayment') }),
        rateField('downPaymentPct', e.homeValue > 0 ? e.downPayment / e.homeValue : 0, { hint: h.downPayment, ...src('downPayment') }),
        { key: 'payCash', kind: 'toggle', value: e.payCash },
        { key: 'termYears', kind: 'choice', value: e.termYears, options: [{ value: 15, label: '15 years' }, { value: 30, label: '30 years' }], ...src('termYears') },
        rateField('rate', e.rate, { max: 0.3, hint: h.rate, ...src('rate') }),
        rateField('propertyTaxRate', e.propertyTaxRate, { max: 0.1, ...src('propertyTaxRate') }),
        moneyField('insuranceMonthly', e.insuranceMonthly.value, { isEstimate: e.insuranceMonthly.isEstimate, ...src('insuranceMonthly') }),
        rateField('upkeepRate', e.upkeepRate, { max: 0.1, ...src('upkeepRate') }),
        { key: 'replaceHousing', kind: 'toggle', value: e.replaceHousing },
      ];
    case 'haveKid':
      return [
        yearField,
        moneyField('childcareMonthly', e.childcareMonthly.value, { isEstimate: e.childcareMonthly.isEstimate, ...src('childcareMonthly') }),
        { key: 'childcareYears', kind: 'count', value: e.childcareYears, min: 0, max: 18, ...src('childcareYears') },
        moneyField('otherMonthly', e.otherMonthly.value, { isEstimate: e.otherMonthly.isEstimate, ...src('otherMonthly') }),
      ];
    case 'newJob': return [yearField, moneyField('takeHomePay', e.takeHomePay, src('takeHomePay'))];
    case 'careerBreak': return [yearField, endYearField(e.endYear)];
    case 'windfall': return [yearField, moneyField('amount', e.amount, src('amount'))];
    case 'retire': return [yearField];
    case 'socialSecurity': return [yearField, moneyField('monthly', e.monthly.value, { isEstimate: e.monthly.isEstimate, ...src('monthly') })];
  }
}

function displayOf(f: FieldSpec): string {
  if (f.display !== undefined) return f.display;
  switch (f.kind) {
    case 'money': return money(f.value as number);
    case 'rate': return pct(f.value as number, 3);
    case 'year': case 'count': return String(f.value);
    case 'toggle': return f.value ? 'Yes' : 'No';
    case 'choice': return f.options?.find((o) => o.value === f.value)?.label ?? String(f.value);
  }
}

function fieldVMs(e: PlanEvent, range: YearRange, sources: DefaultEventSources): EventFieldVM[] {
  return specsOf(e, range, sources).map((f) => ({
    ...f,
    label: copy.editor.fields[f.key] ?? f.key,
    display: displayOf(f),
    isEstimate: f.isEstimate ?? false,
  }));
}

const num = (v: PlanFieldValue): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const nonNeg = (v: PlanFieldValue): number | null => {
  const n = num(v);
  return n === null ? null : Math.max(0, n);
};
/** A typed estimate is the person's own number from then on. */
const typed = (v: number) => ({ value: v, isEstimate: false });

/** `e` with `field` set to `value`; unknown fields and values of the wrong type leave it unchanged. Years are clamped to `range`. */
export function applyEventUpdate(e: PlanEvent, field: string, value: PlanFieldValue, range: YearRange): PlanEvent {
  if (field === 'name') {
    const name = typeof value === 'string' ? value.trim() : '';
    const { name: _old, ...rest } = e;
    return (name === '' ? rest : { ...rest, name }) as PlanEvent;
  }
  if (field === 'year') {
    const y = num(value);
    return y === null ? e : movedEvent(e, clampYear(y, range));
  }
  if (field === 'endYear' && 'endYear' in e) {
    const y = num(value);
    return y === null ? e : ({ ...e, endYear: Math.max(e.year, clampYear(y, range)) } as PlanEvent);
  }
  switch (e.type) {
    case 'income': {
      const n = nonNeg(value);
      return field === 'monthly' && n !== null ? { ...e, monthly: n } : e;
    }
    case 'expense': {
      const n = nonNeg(value);
      if (field === 'amount' && n !== null) return { ...e, amount: n };
      if (field === 'cadence' && (value === 'once' || value === 'monthly')) return { ...e, cadence: value };
      if (e.financing && n !== null) {
        if (field === 'financingDownPayment') return { ...e, financing: { ...e.financing, downPayment: Math.min(n, e.amount) } };
        if (field === 'financingApr') return { ...e, financing: { ...e.financing, apr: n } };
        if (field === 'financingTermMonths') return { ...e, financing: { ...e.financing, termMonths: Math.max(1, Math.round(n)) } };
      }
      return e;
    }
    case 'buyHome': {
      const n = nonNeg(value);
      switch (field) {
        case 'homeValue': return n === null ? e : { ...e, homeValue: n, downPayment: Math.min(e.downPayment, n) };
        case 'downPayment': return n === null ? e : { ...e, downPayment: Math.min(n, e.homeValue) };
        // dollars = pct × price
        case 'downPaymentPct': return n === null ? e : { ...e, downPayment: Math.min(n, 1) * e.homeValue };
        case 'payCash': return typeof value === 'boolean' ? { ...e, payCash: value } : e;
        case 'termYears': return value === 15 || value === 30 ? { ...e, termYears: value } : e;
        case 'rate': return n === null ? e : { ...e, rate: n };
        case 'propertyTaxRate': return n === null ? e : { ...e, propertyTaxRate: n };
        case 'insuranceMonthly': return n === null ? e : { ...e, insuranceMonthly: typed(n) };
        case 'upkeepRate': return n === null ? e : { ...e, upkeepRate: n };
        case 'replaceHousing': return typeof value === 'boolean' ? { ...e, replaceHousing: value } : e;
      }
      return e;
    }
    case 'haveKid': {
      const n = nonNeg(value);
      if (n === null) return e;
      if (field === 'childcareMonthly') return { ...e, childcareMonthly: typed(n) };
      if (field === 'childcareYears') return { ...e, childcareYears: Math.min(18, Math.round(n)) };
      if (field === 'otherMonthly') return { ...e, otherMonthly: typed(n) };
      return e;
    }
    case 'newJob': {
      const n = nonNeg(value);
      return field === 'takeHomePay' && n !== null ? { ...e, takeHomePay: n } : e;
    }
    case 'windfall': {
      const n = nonNeg(value);
      return field === 'amount' && n !== null ? { ...e, amount: n } : e;
    }
    case 'socialSecurity': {
      const n = nonNeg(value);
      return field === 'monthly' && n !== null ? { ...e, monthly: typed(n) } : e;
    }
    case 'careerBreak':
    case 'retire':
      return e;
  }
}

function breakdownOf(e: PlanEventOf<'buyHome'>): EventBreakdownVM {
  const b = buyHomeBreakdown(e);
  const l = copy.editor.breakdown;
  return {
    lines: [
      { key: 'principalAndInterest', label: l.principalAndInterest, amountLabel: money(b.principalAndInterest), amount: b.principalAndInterest },
      { key: 'propertyTax', label: l.propertyTax, amountLabel: money(b.propertyTax), amount: b.propertyTax },
      { key: 'insurance', label: l.insurance, amountLabel: money(b.insurance), amount: b.insurance },
    ],
    totalLabel: money(b.total),
    total: b.total,
  };
}

function financingOf(e: PlanEventOf<'expense'>): EventFinancingVM | null {
  const f = expenseFinancingBreakdown(e);
  if (!f) return null;
  const line = (key: EventFinancingVM['lines'][number]['key'], amount: number) =>
    ({ key, label: copy.financingBreakdown[key], amountLabel: money(amount), amount });
  return { lines: [line('downPayment', f.downPayment), line('financed', f.financed), line('monthlyPayment', f.monthlyPayment), line('totalInterest', f.totalInterest)] };
}

/** previewEvent's KPIs with the event on and without it, and the two plans behind them as series. */
function previewOf(inputs: PlanInputs, scenario: Scenario, event: PlanEvent): EventPreviewVM {
  const { endAge } = scenario.assumptions;
  const pv = previewEvent(inputs.profile, inputs.accounts, scenario, event, inputs.area);
  const k1 = pv.withEvent;
  const k0 = pv.without;
  // The same two scenarios previewEvent plans: the event on in its place, and the event removed.
  const withPlan = planFor(inputs, { ...scenario, events: scenario.events.map((e) => (e.id === event.id ? ({ ...e, enabled: true } as PlanEvent) : e)) });
  const withoutPlan = planFor(inputs, { ...scenario, events: scenario.events.filter((e) => e.id !== event.id) });
  const p = copy.editor.preview;
  const short = shortfallYearsDelta(k1.shortfallAge, k0.shortfallAge, endAge);
  const dRet = k1.netWorthAtRetirement - k0.netWorthAtRetirement;
  const dEnd = k1.netWorthAtEnd - k0.netWorthAtEnd;
  return {
    rows: [
      { id: 'netWorthAtRetirement', label: p.netWorthAtRetirement, withLabel: money(k1.netWorthAtRetirement), withoutLabel: money(k0.netWorthAtRetirement),
        deltaLabel: signedMoney(dRet), tone: toneOf(dRet) },
      { id: 'netWorthAtEnd', label: p.netWorthAtEnd, withLabel: money(k1.netWorthAtEnd), withoutLabel: money(k0.netWorthAtEnd),
        deltaLabel: signedMoney(dEnd), tone: toneOf(dEnd) },
      { id: 'shortfall', label: p.shortfall, withLabel: shortfallLabel(k1.shortfallAge, endAge), withoutLabel: shortfallLabel(k0.shortfallAge, endAge),
        deltaLabel: short.label, tone: toneOf(short.years) },
    ],
    series: withPlan.years.map((y, i) => ({ year: y.year, age: y.age, withEvent: y.netWorth, withoutEvent: withoutPlan.years[i]!.netWorth })),
    leftOverMonthly: pv.leftOverMonthly,
    leftOverMonthlyLabel: copy.leftOverMonthly(money(pv.leftOverMonthly)),
  };
}

export function useEventEditor(id: string | null): EventEditorVM {
  const inputs = usePlanInputs();
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const editEvent = usePlanStore((s) => s.editEvent);
  const edit = usePlanStore((s) => s.edit);
  const setOpenEvent = usePlanStore((s) => s.setOpenEvent);
  const event = scenario?.events.find((e) => e.id === id);
  const scenarioId = scenario?.id;
  const cal = useMemo(() => calendarOf(inputs.profile), [inputs.profile]);

  /** One plan_event_edited per event per page load: its type only, never a value. */
  const edited = useCallback(() => {
    const e = usePlanStore.getState().scenarios.find((s) => s.id === scenarioId)?.events.find((x) => x.id === id);
    if (e) track({ name: 'plan_event_edited', props: { type: e.type } }, { once: `plan_event_edited:${e.id}` });
  }, [scenarioId, id]);

  const update = useCallback(
    (field: string, value: PlanFieldValue) => {
      if (!scenarioId || id === null) return;
      edit(scenarioId, (s) => {
        // Retire's year is the retirement age: moving it moves the age with it (withEventYear).
        const y = num(value);
        if (field === 'year' && y !== null) return withEventYear(s, id, y, cal);
        const e = s.events.find((x) => x.id === id);
        if (!e) return s;
        const next = applyEventUpdate(e, field, value, yearRangeOf(cal, s.assumptions.endAge));
        return next === e ? s : { ...s, events: s.events.map((x) => (x.id === id ? next : x)) };
      });
      edited();
    },
    [scenarioId, id, edit, cal, edited],
  );
  const toggleEnabled = useCallback(() => {
    if (!scenarioId || id === null) return;
    editEvent(scenarioId, id, (e) => ({ ...e, enabled: !e.enabled }));
    edited();
  }, [scenarioId, id, editEvent, edited]);
  const remove = useCallback(() => {
    if (!scenarioId || id === null) return;
    edit(scenarioId, (s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
    setOpenEvent(null);
  }, [scenarioId, id, edit, setOpenEvent]);

  return useMemo((): EventEditorVM => {
    if (!scenario || !event || id === null) return { status: 'notFound', message: copy.editor.notFound };
    const range = yearRangeOf(cal, scenario.assumptions.endAge);
    const sources = defaultEventSources(event.type, eventContextOf(inputs, scenario.assumptions));
    const downPaymentPct = event.type === 'buyHome' ? (event.homeValue > 0 ? event.downPayment / event.homeValue : 0) : null;
    return {
      status: 'ready',
      id,
      type: event.type,
      icon: iconOf(event),
      title: copy.events[event.type].title,
      name: event.name ?? '',
      enabled: event.enabled,
      fields: fieldVMs(event, range, sources),
      breakdown: event.type === 'buyHome' ? breakdownOf(event) : null,
      financing: event.type === 'expense' ? financingOf(event) : null,
      downPaymentPct,
      downPaymentPctLabel: downPaymentPct === null ? null : pct(downPaymentPct, 1),
      preview: previewOf(inputs, scenario, event),
      update,
      toggleEnabled,
      remove,
    };
  }, [scenario, event, id, inputs, cal, update, toggleEnabled, remove]);
}
