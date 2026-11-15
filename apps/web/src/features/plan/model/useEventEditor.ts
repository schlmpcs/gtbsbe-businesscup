// The event panel: an event's fields with their sources and estimate tags, the monthly breakdown of a
// home purchase, the down payment as $ and % (kept in sync), and the with-vs-without preview. The
// breakdown is the engine's buyHomeBreakdown, the preview two plan() runs (with the event on, and
// without it), and a field shows the Source of the engine's default (defaultEventSources) while its
// value is still that default.
//
// Down payment sync (plain arithmetic, the engine is not involved): dollars = pct × price and
// pct = dollars ÷ price. Dollars are the stored field, so a new price keeps the dollars and moves the %.
import { buyHomeBreakdown, defaultEvent, defaultEventSources, type DefaultEventSources } from '@lifeguessr/engine';
import type { PlanEvent, PlanEventOf } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { ageAt, calendarOf, clampYearTo, eventContext, NO_MOVES, planOf, usePlanInputs, type PlanCalendar } from './planEngine';
import { iconOf, money, pct, signedMoney, toneOf } from './planFormat';
import { usePlanStore } from './planStore';
import { movedEvent } from './usePlan';
import type {
  EventBreakdownVM, EventEditorVM, EventFieldVM, EventPreviewVM, PlanFieldValue, Source,
} from './types';

type FieldSpec = Omit<EventFieldVM, 'display' | 'label' | 'isEstimate'> & { display?: string; isEstimate?: boolean };

const moneyField = (key: string, value: number, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, kind: 'money', value, min: 0, ...extra });
const rateField = (key: string, value: number, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, kind: 'rate', value, min: 0, max: 1, ...extra });

/** The engine's default for this event type and the Source of each default amount. */
export type EventDefaults = { values: PlanEvent; sources: DefaultEventSources };

const plain = (v: unknown): unknown => (v !== null && typeof v === 'object' && 'value' in v ? (v as { value: unknown }).value : v);
const same = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : a === b;

/** The field's Source while its value is still the engine's default; after an edit it is the person's number. */
function sourceOf(e: PlanEvent, key: string, d: EventDefaults): Partial<FieldSpec> {
  const source: Source | undefined = d.sources[key];
  if (!source) return {};
  const now = plain((e as Record<string, unknown>)[key]);
  const was = plain((d.values as Record<string, unknown>)[key]);
  return same(now, was) ? { source } : {};
}

function specsOf(e: PlanEvent, cal: PlanCalendar, d: EventDefaults): FieldSpec[] {
  const h = copy.editor.hints;
  const src = (key: string) => sourceOf(e, key, d);
  const yearField = (ev: PlanEvent): FieldSpec => ({ key: 'year', kind: 'year', value: ev.year, min: cal.firstYear, max: cal.lastYear, ...src('year') });
  const endYearField = (value: number): FieldSpec => ({ key: 'endYear', kind: 'year', value, min: cal.firstYear, max: cal.lastYear, ...src('endYear') });
  switch (e.type) {
    case 'income': return [yearField(e), moneyField('monthly', e.monthly, src('monthly')), ...(e.endYear !== undefined ? [endYearField(e.endYear)] : [])];
    case 'expense':
      return [
        yearField(e),
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
        yearField(e),
        moneyField('homeValue', e.homeValue, src('homeValue')),
        moneyField('downPayment', e.downPayment, { hint: h.downPayment, ...src('downPayment') }),
        rateField('downPaymentPct', e.homeValue > 0 ? e.downPayment / e.homeValue : 0, { hint: h.downPayment }),
        { key: 'payCash', kind: 'toggle', value: e.payCash },
        { key: 'termYears', kind: 'choice', value: e.termYears, ...src('termYears'), options: [{ value: 15, label: '15 years' }, { value: 30, label: '30 years' }] },
        rateField('rate', e.rate, { max: 0.3, hint: h.rate, ...src('rate') }),
        rateField('propertyTaxRate', e.propertyTaxRate, { max: 0.1, ...src('propertyTaxRate') }),
        moneyField('insuranceMonthly', e.insuranceMonthly.value, { isEstimate: e.insuranceMonthly.isEstimate, ...src('insuranceMonthly') }),
        rateField('upkeepRate', e.upkeepRate, { max: 0.1, ...src('upkeepRate') }),
        { key: 'replaceHousing', kind: 'toggle', value: e.replaceHousing },
      ];
    case 'haveKid':
      return [
        yearField(e),
        moneyField('childcareMonthly', e.childcareMonthly.value, { isEstimate: e.childcareMonthly.isEstimate, ...src('childcareMonthly') }),
        { key: 'childcareYears', kind: 'count', value: e.childcareYears, min: 0, max: 18, ...src('childcareYears') },
        moneyField('otherMonthly', e.otherMonthly.value, { isEstimate: e.otherMonthly.isEstimate, ...src('otherMonthly') }),
      ];
    case 'newJob': return [yearField(e), moneyField('takeHomePay', e.takeHomePay, src('takeHomePay'))];
    case 'careerBreak': return [yearField(e), endYearField(e.endYear)];
    case 'windfall': return [yearField(e), moneyField('amount', e.amount, src('amount'))];
    case 'retire': return [yearField(e)];
    case 'socialSecurity': return [yearField(e), moneyField('monthly', e.monthly.value, { isEstimate: e.monthly.isEstimate, ...src('monthly') })];
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

function fieldVMs(e: PlanEvent, cal: PlanCalendar, d: EventDefaults): EventFieldVM[] {
  return specsOf(e, cal, d).map((f) => ({
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

/** `e` with `field` set to `value`; unknown fields and values of the wrong type leave it unchanged. Years are clamped to `cal`. */
export function applyEventUpdate(e: PlanEvent, field: string, value: PlanFieldValue, cal: PlanCalendar): PlanEvent {
  const clampYear = (y: number) => clampYearTo(cal, y);
  if (field === 'name') {
    const name = typeof value === 'string' ? value.trim() : '';
    const { name: _old, ...rest } = e;
    return (name === '' ? rest : { ...rest, name }) as PlanEvent;
  }
  if (field === 'year') {
    const y = num(value);
    return y === null ? e : movedEvent(e, clampYear(y));
  }
  if (field === 'endYear' && 'endYear' in e) {
    const y = num(value);
    return y === null ? e : ({ ...e, endYear: Math.max(e.year, clampYear(y)) } as PlanEvent);
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
      if (field === 'childcareYears') return { ...e, childcareYears: Math.round(n) };
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

export function useEventEditor(id: string | null): EventEditorVM {
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const editEvent = usePlanStore((s) => s.editEvent);
  const edit = usePlanStore((s) => s.edit);
  const setOpenEvent = usePlanStore((s) => s.setOpenEvent);
  const event = scenario?.events.find((e) => e.id === id);
  const scenarioId = scenario?.id;
  const moves = usePlanStore((s) => (scenarioId ? s.movesApplied[scenarioId] : undefined) ?? NO_MOVES);
  const inputs = usePlanInputs();
  const endAge = scenario?.assumptions.endAge ?? 0;
  const cal = useMemo(() => calendarOf(inputs.profile, endAge), [inputs.profile, endAge]);

  const update = useCallback(
    (field: string, value: PlanFieldValue) => {
      if (!scenarioId || id === null) return;
      editEvent(scenarioId, id, (e) => applyEventUpdate(e, field, value, cal));
      // Retire's year is the retirement age: keep the two together.
      const y = num(value);
      if (field === 'year' && y !== null) {
        edit(scenarioId, (s) =>
          s.events.some((e) => e.id === id && e.type === 'retire')
            ? { ...s, assumptions: { ...s.assumptions, retireAge: ageAt(cal, clampYearTo(cal, y)) } }
            : s,
        );
      }
    },
    [scenarioId, id, editEvent, edit, cal],
  );
  const toggleEnabled = useCallback(() => {
    if (scenarioId && id !== null) editEvent(scenarioId, id, (e) => ({ ...e, enabled: !e.enabled }));
  }, [scenarioId, id, editEvent]);
  const remove = useCallback(() => {
    if (!scenarioId || id === null) return;
    edit(scenarioId, (s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
    setOpenEvent(null);
  }, [scenarioId, id, edit, setOpenEvent]);

  return useMemo((): EventEditorVM => {
    if (!scenario || !event || id === null) return { status: 'notFound', message: copy.editor.notFound };

    // Turning the eye off keeps the preview of what the event would do: "with" has it on either way.
    const withPlan = event.enabled
      ? planOf(inputs, scenario, moves)
      : planOf(inputs, { ...scenario, events: scenario.events.map((e) => (e.id === id ? { ...e, enabled: true } : e)) }, moves);
    const withoutPlan = planOf(inputs, { ...scenario, events: scenario.events.filter((e) => e.id !== id) }, moves);
    const ctx = eventContext(inputs, scenario);
    const defaults: EventDefaults = { values: defaultEvent(event.type, ctx), sources: defaultEventSources(event.type, ctx) };
    const k1 = withPlan.kpis;
    const k0 = withoutPlan.kpis;
    const p = copy.editor.preview;
    const shortLabel = (age: number | null) => (age === null ? copy.kpi.shortfall.never(scenario.assumptions.endAge) : copy.kpi.shortfall.age(age));
    const yrs = (k1.shortfallAge ?? scenario.assumptions.endAge + 1) - (k0.shortfallAge ?? scenario.assumptions.endAge + 1);
    const preview: EventPreviewVM = {
      rows: [
        { id: 'netWorthAtRetirement', label: p.netWorthAtRetirement, withLabel: money(k1.netWorthAtRetirement), withoutLabel: money(k0.netWorthAtRetirement),
          deltaLabel: signedMoney(k1.netWorthAtRetirement - k0.netWorthAtRetirement), tone: toneOf(k1.netWorthAtRetirement - k0.netWorthAtRetirement) },
        { id: 'netWorthAtEnd', label: p.netWorthAtEnd, withLabel: money(k1.netWorthAtEnd), withoutLabel: money(k0.netWorthAtEnd),
          deltaLabel: signedMoney(k1.netWorthAtEnd - k0.netWorthAtEnd), tone: toneOf(k1.netWorthAtEnd - k0.netWorthAtEnd) },
        { id: 'shortfall', label: p.shortfall, withLabel: shortLabel(k1.shortfallAge), withoutLabel: shortLabel(k0.shortfallAge),
          deltaLabel: yrs === 0 ? '—' : p.years(`${yrs > 0 ? '+' : '−'}${Math.abs(yrs)}`), tone: toneOf(yrs) },
      ],
      series: withPlan.years.map((y, i) => ({ year: y.year, age: y.age, withEvent: y.netWorth, withoutEvent: withoutPlan.years[i]!.netWorth })),
    };

    const downPaymentPct = event.type === 'buyHome' ? (event.homeValue > 0 ? event.downPayment / event.homeValue : 0) : null;
    return {
      status: 'ready',
      id,
      type: event.type,
      icon: iconOf(event),
      title: copy.events[event.type].title,
      name: event.name ?? '',
      enabled: event.enabled,
      fields: fieldVMs(event, cal, defaults),
      breakdown: event.type === 'buyHome' ? breakdownOf(event) : null,
      downPaymentPct,
      downPaymentPctLabel: downPaymentPct === null ? null : pct(downPaymentPct, 1),
      preview,
      update,
      toggleEnabled,
      remove,
    };
  }, [scenario, event, id, moves, inputs, cal, update, toggleEnabled, remove]);
}
