// Display helpers shared by the /plan hooks. Rounding happens here and nowhere else (the engine never
// rounds). No amounts in event names, no math beyond picking a value out of the plan.
import type { Money, PlanEvent, PlanKpis, Rate } from '@lifeguessr/types';
import { plan as copy } from '@/copy';
import { formatMoney, formatRate } from '@/lib/format';
import { EVENT_ICONS } from './planEngine';
import type { PlanKpiVM, PlanTone } from './types';

export const money = (v: Money): string => formatMoney(v);
export const signedMoney = (v: Money): string => formatMoney(v, { signed: true });
export const pct = (v: Rate, digits = 1): string => formatRate(v, digits);
export const toneOf = (v: number): PlanTone => (v >= 0 ? 'good' : 'bad');

export function kpiVMs(kpis: PlanKpis, endAge: number): PlanKpiVM[] {
  const nw = (id: 'netWorthEndOfYear' | 'netWorthAtRetirement' | 'netWorthAtEnd', label: string, value: Money): PlanKpiVM => ({
    id, label, value: money(value), raw: value, tone: toneOf(value), tooltipKey: id, tooltip: copy.kpi[id].tooltip,
  });
  return [
    nw('netWorthEndOfYear', copy.kpi.netWorthEndOfYear.label, kpis.netWorthEndOfYear),
    nw('netWorthAtRetirement', copy.kpi.netWorthAtRetirement.label(kpis.retireAge), kpis.netWorthAtRetirement),
    nw('netWorthAtEnd', copy.kpi.netWorthAtEnd.label(endAge), kpis.netWorthAtEnd),
    {
      id: 'shortfall',
      label: copy.kpi.shortfall.label,
      value: kpis.shortfallAge === null ? copy.kpi.shortfall.never(endAge) : copy.kpi.shortfall.age(kpis.shortfallAge),
      raw: kpis.shortfallAge,
      tone: kpis.shortfallAge === null ? 'good' : 'bad',
      tooltipKey: 'shortfall',
      tooltip: copy.kpi.shortfall.tooltip,
    },
  ];
}

export function eventSummary(e: PlanEvent): string {
  const s = copy.eventSummary;
  switch (e.type) {
    case 'income': return s.income(money(e.monthly));
    case 'expense': return e.cadence === 'monthly' ? s.expenseMonthly(money(e.amount)) : s.expenseOnce(money(e.amount));
    case 'buyHome': return e.payCash ? s.buyHomeCash(money(e.homeValue)) : s.buyHome(money(e.homeValue), pct(e.homeValue > 0 ? e.downPayment / e.homeValue : 0, 0));
    case 'haveKid': return s.haveKid(money(e.childcareMonthly.value), e.childcareYears);
    case 'newJob': return s.newJob(money(e.takeHomePay));
    case 'careerBreak': return s.careerBreak(e.endYear);
    case 'windfall': return s.windfall(money(e.amount));
    case 'retire': return s.retire;
    case 'socialSecurity': return s.socialSecurity(money(e.monthly.value));
  }
}

export const iconOf = (e: PlanEvent) => EVENT_ICONS[e.type];
