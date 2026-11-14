// S14 Monthly check-in. Spec: docs/design/USER-JOURNEY.md → S14; engine: packages/engine/checkin.ts.
//
// - "Fast-forward 1 month (simulated)": the engine makes up the next month from the plan (seeded by
//   the month, so the same month always comes out the same) and runs it through simulate: end
//   balances, net worth, the number 10 years on (rules forecast, today's dollars).
// - The plan is the user's profile with the committed move's patch applied (a committed move is one
//   the user is doing), so its progress shows in the months.
// - Pro: "Save check-in" keeps the month in this browser's store (not the server session: its
//   contract has no field for it); the next fast-forward continues from its end balances. History,
//   the value check and goal progress read the saved months. Free: one simulated month and forecast
//   vs actual, with the paywall card where Save and history would be.
// No funnel event: the event list is full and none of its names fits a check-in.
import {
  applyPatch, checkinRecord, checkinStart, checkinSummary, forecast, hasEstimates, seedOf, simulateMonth,
} from '@lifeguessr/engine';
import type { CheckinRecord, Move, Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { checkin as copy } from '@/copy';
import { localMonthDay } from '@/lib/dates';
import { monthlyReminderIcs } from '@/lib/ics';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore, usePro } from '@/state';
import type { CheckinGoalVM, CheckinHistoryRowVM, CheckinMoveVM, CheckinNumberVM, CheckinVM } from './types';

const NO_CHECKINS: CheckinRecord[] = [];

/** 'YYYY-MM' plus n months. */
export function addMonths(yyyyMm: string, n: number): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The profile the check-ins run on: the committed move's patch applied, when it is the profile's. */
export function checkinPlan(profile: Profile, committedMove: Move | null): Profile {
  return committedMove && profile.committedMoveId === committedMove.id ? applyPatch(profile, committedMove.patch) : profile;
}

/** Download text as a file (browser only). */
function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const CHECKIN_ICS_FILENAME = 'monthly-check-in.ics';

export function useCheckin(opts: { now?: Date } = {}): CheckinVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const committedMove = useAppStore((s) => s.committedMove);
  const goal = useAppStore((s) => s.goal);
  const savedCheckins = useAppStore((s) => s.checkins);
  const saveCheckin = useAppStore((s) => s.saveCheckin);
  const pro = usePro();
  const isPro = pro.isPro;

  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const todayMonth = localMonthDay(opts.now).month;
  // A free user's saved months (from an earlier Pro) stay in the store but are not used.
  const history = isPro ? savedCheckins : NO_CHECKINS;
  const last = history[history.length - 1] ?? null;
  const nextMonth = last ? addMonths(last.month, 1) : addMonths(todayMonth, 1);

  const rates = useMemo(() => areaRates(profile), [profile]);
  const plan = useMemo(() => checkinPlan(profile, committedMove), [profile, committedMove]);
  const activeMove = plan === profile ? null : committedMove;

  // The month on screen, recomputed from the plan (a stale one, e.g. after a save, is dropped).
  const pending: Loadable<CheckinRecord> | null = useMemo(() => {
    if (pendingMonth === null || pendingMonth !== nextMonth) return null;
    return runEngine(() => {
      const start = checkinStart(plan, history, { rates });
      const index = (last?.monthIndex ?? 0) + 1;
      return checkinRecord(start, nextMonth, simulateMonth(start, index, seedOf(nextMonth)), { rates });
    });
  }, [pendingMonth, nextMonth, plan, history, last, rates]);
  const pendingRecord = pending?.status === 'ready' ? pending.data : null;

  const summary = useMemo(
    () => runEngine(() => checkinSummary(plan, history, pendingRecord, { rates, goal: isPro ? goal : null, committedMove: activeMove })),
    [plan, history, pendingRecord, rates, isPro, goal, activeMove],
  );
  const base10y = useMemo(() => runEngine(() => forecast(plan, 10, { todaysDollars: true, rates }).in10y.mid), [plan, rates]);

  const shownRecord = pendingRecord ?? last;
  const shownMonth = shownRecord?.month ?? todayMonth;
  const shownYear = Number(shownMonth.slice(0, 4));

  const number: Loadable<CheckinNumberVM> = useMemo(() => {
    if (pending?.status === 'error') return pending;
    if (summary.status !== 'ready') return summary;
    const n = summary.data.number;
    return {
      status: 'ready',
      data: {
        today: n.today,
        in10y: n.in10y.mid,
        low: n.in10y.low,
        high: n.in10y.high,
        horizonYear: shownYear + 10,
        change10y: n.change10y,
        hasChange: shownRecord !== null,
        source: 'rules',
        isEstimate: hasEstimates(plan),
      },
    };
  }, [pending, summary, shownYear, shownRecord, plan]);

  const goalVM: Loadable<CheckinGoalVM | null> = useMemo(() => {
    if (summary.status !== 'ready') return summary;
    const g = summary.data.goal;
    if (!g) return { status: 'ready', data: null };
    return {
      status: 'ready',
      data: {
        target: g.goal.target,
        year: Number(todayMonth.slice(0, 4)) + g.goal.years,
        projected: g.projected.mid,
        gap: g.gap,
        progress: Math.min(1, Math.max(0, g.progress)),
        verdict: g.verdict,
      },
    };
  }, [summary, todayMonth]);

  const move: CheckinMoveVM | null = useMemo(() => {
    if (!activeMove) return null;
    const progress = summary.status === 'ready' ? summary.data.move : null;
    const debtId = activeMove.patch.debts?.find((d) => d.extraPayment !== undefined)?.id;
    return {
      kind: activeMove.kind,
      category: activeMove.category,
      debtKind: plan.debts.find((d) => d.id === debtId)?.kind,
      progress,
    };
  }, [activeMove, summary, plan]);

  const historyRows: CheckinHistoryRowVM[] = useMemo(() => {
    if (!isPro || base10y.status !== 'ready') return [];
    return history
      .map((r, i) => ({ month: r.month, number10y: r.number10y, change: r.number10y - (history[i - 1]?.number10y ?? base10y.data) }))
      .reverse();
  }, [isPro, history, base10y]);

  const fastForward = useCallback(() => {
    setJustSaved(null);
    setPendingMonth(nextMonth);
  }, [nextMonth]);

  const save = useCallback(() => {
    if (!isPro || !pendingRecord) return;
    saveCheckin(pendingRecord);
    setJustSaved(pendingRecord.month);
    setPendingMonth(null);
  }, [isPro, pendingRecord, saveCheckin]);

  const downloadCalendar = useCallback(() => {
    const t = copy.calendar;
    const ics = monthlyReminderIcs({
      startMonth: addMonths(localMonthDay().month, 1),
      now: new Date(),
      title: t.eventTitle,
      description: t.eventBody,
      url: `${window.location.origin}${SCREEN_ROUTES.S14}`,
    });
    download(CHECKIN_ICS_FILENAME, ics, 'text/calendar;charset=utf-8');
  }, []);

  const summaryData = summary.status === 'ready' ? summary.data : null;
  return {
    status: ready ? 'ready' : 'loading',
    nextMonth,
    current: shownRecord && summaryData
      ? {
          month: shownRecord.month,
          simulated: true,
          rows: summaryData.rows,
          forecastTotal: summaryData.forecastTotal,
          actualTotal: summaryData.actualTotal,
          saved: shownRecord !== pendingRecord,
        }
      : null,
    canFastForward: pendingRecord === null,
    fastForward,
    number,
    goal: isPro ? goalVM : { status: 'ready', data: null },
    move,
    value: isPro ? (summaryData?.value ?? null) : null,
    history: historyRows,
    canSave: isPro && pendingRecord !== null,
    save,
    justSaved,
    downloadCalendar,
    pro: { isPro, known: pro.known, href: SCREEN_ROUTES.S15 },
    futureHref: SCREEN_ROUTES.S10,
  };
}
