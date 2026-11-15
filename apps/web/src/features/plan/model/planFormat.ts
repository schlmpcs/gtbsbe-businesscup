// Display helpers shared by the /plan hooks. Rounding happens here and nowhere else (the engine never
// rounds). No amounts in event names, no math beyond picking a value out of an engine result.
import { ACCOUNT_GROUPS, type Account, type AccountGroup, type Money, type PlanEvent, type PlanEventType, type PlanKpis, type Rate } from '@lifeguessr/types';
import { plan as copy } from '@/copy';
import { formatMoney, formatRate } from '@/lib/format';
import type { PlanEventIconId, PlanKpiVM, PlanTone } from './types';

export const EVENT_ICONS: Record<PlanEventType, PlanEventIconId> = {
  income: 'cash', expense: 'receipt', buyHome: 'home', haveKid: 'kid', newJob: 'briefcase',
  careerBreak: 'pause', windfall: 'gift', retire: 'beach', socialSecurity: 'shield',
};

/** Types a plan holds once. */
export const SINGLE_EVENT_TYPES: readonly PlanEventType[] = ['retire', 'socialSecurity'];

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

/** "Age 35" or "Past 90". */
export const shortfallLabel = (age: number | null, endAge: number): string =>
  (age === null ? copy.kpi.shortfall.never(endAge) : copy.kpi.shortfall.age(age));

/** Years between two first-shortfall ages ("never" counts as endAge + 1), signed: "+3 years", or "—". */
export function shortfallYearsDelta(withAge: number | null, withoutAge: number | null, endAge: number): { label: string; years: number } {
  const years = (withAge ?? endAge + 1) - (withoutAge ?? endAge + 1);
  return { years, label: years === 0 ? '—' : copy.editor.preview.years(`${years > 0 ? '+' : '−'}${Math.abs(years)}`) };
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

/** The label of a cash-flow line key of plan() ('takeHomePay', 'oneOffCosts', …). */
export const cashFlowLineLabel = (key: string): string =>
  copy.cashFlowLines[key] ?? copy.tables.cashFlow.lines[key] ?? key;

const isGroup = (g: string): g is AccountGroup => (ACCOUNT_GROUPS as readonly string[]).includes(g);

/**
 * Account name and group for a plan row id: one of the person's accounts, a row an event made
 * (`<eventId>:home`, `:mortgage`, `:loan`, `:<group>`; named after the event) or a group without an
 * account (`group:<group>`).
 */
export function accountLabel(id: string, accounts: readonly Account[], events: readonly PlanEvent[]): { name: string; group: AccountGroup } | null {
  const a = accounts.find((x) => x.id === id);
  if (a) return { name: a.name, group: a.group };
  const cut = id.lastIndexOf(':');
  if (cut < 0) return null;
  const head = id.slice(0, cut);
  const part = id.slice(cut + 1);
  if (head === 'group' && isGroup(part)) return { name: copy.groups[part], group: part };
  const e = events.find((x) => x.id === head);
  if (!e) return null;
  const title = e.name ?? copy.events[e.type].title;
  if (part === 'home') return { name: e.name ?? copy.accountRows.home, group: 'realEstate' };
  if (part === 'mortgage') return { name: copy.accountRows.mortgage(e.name ?? null), group: 'mortgage' };
  if (part === 'loan') return { name: copy.accountRows.loan(title), group: 'loan' };
  return { name: title, group: isGroup(part) ? part : 'otherAsset' };
}
