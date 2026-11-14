// S14 Monthly check-in, a mock screen (T11). The projection comes from the engine's monthEnd() on the
// fixture history below; until T9 lands, monthEnd returns no 3-month average, so the screen falls
// back to MOCK_MONTH_END (labelled sample values). The card progress uses the demo profile and
// payoffOrder() for the months left.
import { monthEnd, payoffOrder, type CurrentMonth } from '@lifeguessr/engine';
import type { CategoryTotals, CostCategory, MonthEnd, Money, Profile } from '@lifeguessr/types';
import { cloneProfileDemo } from '@/fixtures';
import { SCREEN_ROUTES } from '@/lib/screens';
import type { CheckinVM } from './types';

type Totals = Record<CostCategory, Money>;
const totals = (t: Partial<Totals>): Totals => ({
  rentUtilities: 0, car: 0, childcare: 0, groceries: 0, eatingOut: 0, subscriptions: 0, debtPayments: 0, other: 0, ...t,
});

/** FIXTURE: three full months of category totals (sample statement history for the preview). */
export const CHECKIN_HISTORY: CategoryTotals[] = [
  { month: '2026-08', totals: totals({ rentUtilities: 1950, car: 305, groceries: 530, eatingOut: 330, subscriptions: 85, other: 440 }), oneOffs: [] },
  { month: '2026-09', totals: totals({ rentUtilities: 1950, car: 315, groceries: 515, eatingOut: 345, subscriptions: 85, other: 455 }), oneOffs: [] },
  { month: '2026-10', totals: totals({ rentUtilities: 1950, car: 310, groceries: 515, eatingOut: 345, subscriptions: 85, other: 455 }), oneOffs: [] },
];

/** FIXTURE: the month so far (day 15 of 30). */
export const CHECKIN_CURRENT: CurrentMonth = {
  month: '2026-11',
  day: 15,
  totals: totals({ rentUtilities: 975, car: 155, groceries: 230, eatingOut: 240, subscriptions: 58.5, other: 225 }),
};

/** MOCK: what monthEnd should return for the fixtures above; used only while the engine stub returns no average. */
export const MOCK_MONTH_END: MonthEnd = {
  projectedSpend: 3767,
  vsAverage: 112,
  drifts: [
    { category: 'eatingOut', delta: 140 },
    { category: 'subscriptions', delta: 32 },
    { category: 'groceries', delta: -60 },
  ],
};

/** FIXTURE: card balance today after the committed "pay the card first" move, and its extra payment. */
export const MOCK_CARD_PROGRESS = { balanceNow: 4700, extraPayment: 300 } as const;

/** Categories that get a tile on the check-in (drifted ones first, the rest as "on track"). */
const TILE_CATEGORIES: CostCategory[] = ['eatingOut', 'subscriptions', 'groceries', 'car'];

export function buildCheckinVM(profile: Profile = cloneProfileDemo()): CheckinVM {
  const fromEngine = monthEnd(profile, CHECKIN_HISTORY, CHECKIN_CURRENT);
  const source = fromEngine.vsAverage === null ? 'fixture' : 'engine';
  const m = source === 'engine' ? fromEngine : MOCK_MONTH_END;
  const difference = m.vsAverage ?? 0;

  const card = profile.debts.find((d) => d.kind === 'card');
  const startBalance = card?.balance ?? 0;
  const paid = Math.max(0, startBalance - MOCK_CARD_PROGRESS.balanceNow);
  const monthsLeft = card
    ? payoffOrder([{ ...card, balance: MOCK_CARD_PROGRESS.balanceNow, extraPayment: MOCK_CARD_PROGRESS.extraPayment }], 0, 'avalanche').payoffMonth
    : 0;

  const drifted = new Set(m.drifts.map((d) => d.category));
  return {
    monthName: 'November',
    nextStatementMonthName: 'October',
    projected: m.projectedSpend,
    average: m.projectedSpend - difference,
    difference,
    direction: Math.round(difference) === 0 ? 'even' : difference > 0 ? 'over' : 'under',
    drifts: m.drifts.map((d) => ({ category: d.category, delta: d.delta })),
    onTrack: TILE_CATEGORIES.filter((c) => !drifted.has(c)),
    move: { startBalance, paid, progress: startBalance > 0 ? paid / startBalance : 0, monthsLeft },
    uploadHref: SCREEN_ROUTES.S9,
    source,
  };
}
