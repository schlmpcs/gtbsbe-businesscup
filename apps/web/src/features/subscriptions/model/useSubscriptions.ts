// S21 Subscription audit (M5, issue #81): the view-model of `/tools/subscriptions`.
//
//   guess → ticks → reveal → statement → findings → plan
//
// Cold first: the guess, the ticks and the reveal need no profile, no game and no upload. A statement
// is the upgrade; everything it finds stays in this browser (`store`). The cancel plan is one Next Move
// candidate (`plan.candidate`); its 10-year number is measured by `useCancelResult`, which a screen
// mounts only while something is marked, so this hook never asks the forecast route.
//
// Everything that comes from outside the feature is a parameter (`SubscriptionsDeps`): the catalogue
// of known services (M4), the tool's slice of the local store (M2), the statement categorizer client
// and the event sender. Wiring them is `./wiring.ts`.
import { auditTotals, detectSubscriptions, subsMinCharges } from '@lifeguessr/engine';
import {
  ServiceCategorySchema,
  type ClientFunnelEvent, type KnownService, type MissBucket, type Profile, type ServiceCategory, type ToolId,
  type StatementClass, type SubscriptionFinding,
} from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { patchesEqual } from '@/features/forecast/model/forecastAnswer';
import { categorizeStatement } from '@/lib/api/statement';
import { downloadRenewalsCalendar } from '@/lib/download';
import { track as defaultTrack, trackTool as defaultTrackTool } from '@/lib/events';
import { renewalsFromFindings } from '@/lib/ics';
import { toVMError } from '@/lib/model/errors';
import { useAppReady, useAppStore } from '@/state';
import { getAnonId } from '@/state/anonId';
import {
  CANCEL_MOVE_ID, cancelCandidate, combineFindings, displayNameOf, forgottenIds, isCounted, markedFindings, marksWithout,
  missBucketOf, missFactor, monthlyOf, pruneMarks, tickServices,
} from './audit';
import { GUESS_PRESETS, SURVEY } from './constants';
import { readStatementForAudit, toStatementError } from './readForAudit';
import { emptyToolState, type SubscriptionsStore, type SubscriptionsToolState } from './state';
import type {
  ApplyVM, FindingVM, FindingsVM, PlanVM, RenewalsVM, RevealVM, StatementErrorVM,
  StatementVM, StepVM, SubscriptionsStep, SubscriptionsVM, TickGroupVM, TickPlanVM, TicksVM, DownloadOutcome,
} from './types';

export type SubscriptionsDeps = {
  /** The catalogue of known services (M4 `knownServices`). */
  catalogue: readonly KnownService[];
  /** The tool's slice of the local store (M2 `tools.subscriptions`). */
  store: SubscriptionsStore;
  /** The event sender (lib/events `track`). */
  track?: typeof defaultTrack;
  /** Records that the tool was opened: one `tool_opened` per page session (lib/events `trackTool`, M2). */
  trackTool?: (tool: ToolId) => void;
  /** The statement categorizer client (lib/api/statement `categorizeStatement`). */
  categorize?: typeof categorizeStatement;
  /** Saves the renewals calendar file (lib/download `downloadRenewalsCalendar`). */
  downloadRenewals?: typeof downloadRenewalsCalendar;
};

const STEP_ORDER: readonly SubscriptionsStep[] = ['guess', 'ticks', 'reveal', 'statement', 'findings', 'plan'];

const directionOf = (miss: MissBucket | null): RevealVM['direction'] =>
  miss === null ? null : miss === 'under0.5' || miss === '0.5to0.8' ? 'lower' : miss === '0.8to1.25' ? 'close' : 'higher';

/** The step to start on: where the saved state leaves off. */
function defaultStep(state: SubscriptionsToolState): SubscriptionsStep {
  if (state.audit) return 'findings';
  return state.ticks.length > 0 || state.guess !== undefined ? 'ticks' : 'guess';
}

/** `value` once in the list: added when absent. */
const withId = (list: readonly string[], id: string): string[] => (list.includes(id) ? [...list] : [...list, id]);
const without = (list: readonly string[], id: string): string[] => list.filter((x) => x !== id);

export function useSubscriptions(profile: Profile, deps: SubscriptionsDeps): SubscriptionsVM {
  const { catalogue, store } = deps;
  const track = deps.track ?? defaultTrack;
  const trackTool = deps.trackTool ?? defaultTrackTool;
  const categorize = deps.categorize ?? categorizeStatement;
  const downloadRenewals = deps.downloadRenewals ?? downloadRenewalsCalendar;

  const ready = useAppReady();
  const profileOrigin = useAppStore((s) => s.profileOrigin);
  const subscriptionsDetected = useAppStore((s) => s.subscriptionsDetected);
  const committedMove = useAppStore((s) => s.committedMove);
  const applySubscriptionsAudit = useAppStore((s) => s.applySubscriptionsAudit);

  // ----- saved state ------------------------------------------------------------------------------
  // `latest` is the newest state this hook has written or been given, so two actions in a row (before
  // React renders) both build on each other, never on a render's stale copy.
  const saved = store.state;
  const state = useMemo(() => saved ?? emptyToolState(), [saved]);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });
  const { save, clear } = store;
  const update = useCallback(
    (change: (s: SubscriptionsToolState) => SubscriptionsToolState) => {
      const previous = latest.current;
      const changed = change(previous);
      // Every write leaves only the marks that still point at one counted finding (see `markTarget` in ./audit).
      const next = { ...changed, cancelMarked: pruneMarks(changed, catalogue) };
      latest.current = next;
      try {
        save(next);
      } catch (err) {
        latest.current = previous; // the store refused it: nothing changed
        throw err;
      }
    },
    [save, catalogue],
  );

  // ----- events (enums and counts only) ----------------------------------------------------------
  const sender = useRef(track);
  useEffect(() => {
    sender.current = track;
  });
  const sentOnce = useRef(new Set<string>());
  const emit = useCallback((event: ClientFunnelEvent, once?: string) => {
    if (once === undefined) return void sender.current(event);
    if (sentOnce.current.has(once)) return;
    sentOnce.current.add(once);
    sender.current(event, { once });
  }, []);

  // `trackTool` already sends one `tool_opened` per page session (its own once-key), so no key is kept here.
  const opened = useRef(trackTool);
  useEffect(() => {
    opened.current = trackTool;
  });
  useEffect(() => {
    if (ready) opened.current('subscriptions');
  }, [ready]);

  // ----- what the state says ----------------------------------------------------------------------
  const combined = useMemo(() => combineFindings(state, catalogue), [state, catalogue]);
  const { confirmed, statement: statementFindings, ticked: tickAudit, merged } = combined;
  const counted = useMemo(() => merged.filter((f) => isCounted(f, confirmed)), [merged, confirmed]);
  // The findings marked to cancel: each mark resolved against the current findings (see `markTarget` in ./audit).
  const marked = useMemo(() => markedFindings(state, catalogue), [state, catalogue]);
  const markedIds = useMemo(() => new Set(marked.map((f) => f.id)), [marked]);
  const statementTotals = useMemo(() => auditTotals(statementFindings, confirmed), [statementFindings, confirmed]);
  const mergedTotals = useMemo(() => auditTotals(merged, confirmed), [merged, confirmed]);
  const hasAudit = state.audit !== undefined;

  // ----- steps -------------------------------------------------------------------------------------
  const canReveal = tickAudit.findings.length > 0 || hasAudit;
  const availability: Record<SubscriptionsStep, boolean> = {
    guess: true, ticks: true, reveal: canReveal, statement: true, findings: hasAudit, plan: counted.length > 0,
  };
  // Where to start is read once, when the saved state has loaded: it must not follow the state afterwards
  // (typing a guess would otherwise move the person on). `chosen` is where they went since.
  const [start, setStart] = useState<SubscriptionsStep | null>(null);
  if (ready && start === null) setStart(defaultStep(state));
  const [chosen, setChosen] = useState<SubscriptionsStep | null>(null);
  const resting = start !== null && availability[start] ? start : 'guess';
  const step: SubscriptionsStep = chosen !== null && availability[chosen] ? chosen : resting;
  const steps: StepVM[] = STEP_ORDER.map((id) => ({ id, available: availability[id] }));

  // ----- guess -------------------------------------------------------------------------------------
  const setGuess = useCallback(
    (value: number | null) => {
      update((s) => {
        const { guess: _previous, ...rest } = s;
        return value === null || !Number.isFinite(value) || value < 0 ? rest : { ...rest, guess: value };
      });
    },
    [update],
  );

  // ----- ticks -------------------------------------------------------------------------------------
  const tickList = useMemo(() => tickServices(catalogue), [catalogue]);
  const ticksView: Omit<TicksVM, 'toggle'> = useMemo(() => {
    const chosenPlan = new Map(state.ticks.map((t) => [t.serviceId, t.planId]));
    const services = tickList.map(({ service, plans, defaultPlan }) => {
      const tickedPlan = plans.find((p) => p.id === chosenPlan.get(service.id));
      const toVM = (p: (typeof plans)[number]): TickPlanVM => ({
        id: p.id, name: p.name, price: p.price, cadence: p.cadence, monthly: monthlyOf(p.price, p.cadence),
      });
      return {
        serviceId: service.id, name: service.name, category: service.category, ticked: tickedPlan !== undefined,
        plan: toVM(tickedPlan ?? defaultPlan), plans: plans.map(toVM),
        priceYear: service.priceYear, source: service.source,
        // A tick price is always an estimate: no statement has been shown, whatever the catalogue says about its own price.
        isEstimate: true,
      };
    });
    const groups: TickGroupVM[] = ServiceCategorySchema.options.map((category: ServiceCategory) => ({
      category, services: services.filter((s) => s.category === category),
    })).filter((g) => g.services.length > 0);
    return { groups, count: tickAudit.findings.length, monthly: tickAudit.monthlyTotal, yearly: tickAudit.yearlyTotal };
  }, [state.ticks, tickList, tickAudit]);

  const toggleTick = useCallback(
    (serviceId: string, planId?: string) => {
      const entry = tickList.find((t) => t.service.id === serviceId);
      if (!entry) return;
      const asked = planId === undefined ? undefined : entry.plans.find((p) => p.id === planId);
      if (planId !== undefined && !asked) return;
      const known = (t: { serviceId: string; planId: string }) =>
        tickList.some((l) => l.service.id === t.serviceId && l.plans.some((p) => p.id === t.planId));
      const current = latest.current.ticks.find((t) => t.serviceId === serviceId);
      const off = current !== undefined && (asked === undefined || asked.id === current.planId);
      if (!off) emit({ name: 'subs_started', props: { path: 'tickList' } }, 'subs:started:tickList');
      update((s) => {
        const kept = s.ticks.filter((t) => t.serviceId === serviceId || known(t));
        if (off) {
          return { ...s, ticks: kept.filter((t) => t.serviceId !== serviceId) };
        }
        const tick = { serviceId, planId: (asked ?? entry.defaultPlan).id };
        const exists = kept.some((t) => t.serviceId === serviceId);
        return { ...s, ticks: exists ? kept.map((t) => (t.serviceId === serviceId ? tick : t)) : [...kept, tick] };
      });
    },
    [tickList, emit, update],
  );

  // ----- reveal ------------------------------------------------------------------------------------
  const reveal: RevealVM = useMemo(() => {
    const guess = state.guess ?? null;
    const against = hasAudit ? 'statement' : 'ticks';
    const actual = hasAudit ? statementTotals.monthlyTotal : tickAudit.monthlyTotal;
    const miss = missBucketOf(guess, actual);
    const years = tickAudit.findings.map((f) => catalogue.find((s) => s.id === f.serviceId)?.priceYear).filter((y): y is number => y !== undefined);
    return {
      guess, against, actual, actualYearly: hasAudit ? statementTotals.yearlyTotal : tickAudit.yearlyTotal,
      ticks: { count: tickAudit.findings.length, monthly: tickAudit.monthlyTotal, priceYear: years.length > 0 ? Math.max(...years) : null },
      statement: state.audit
        ? { monthly: statementTotals.monthlyTotal, yearly: statementTotals.yearlyTotal, monthsCovered: state.audit.monthsCovered }
        : null,
      missFactor: missFactor(guess, actual), miss, direction: directionOf(miss),
      gap: guess === null ? null : Math.round(Math.abs(actual - guess) * 100) / 100,
      survey: { guessed: SURVEY.guessed, itemized: SURVEY.itemized, source: SURVEY.source },
    };
  }, [state.guess, state.audit, hasAudit, statementTotals, tickAudit, catalogue]);

  const goTo = (target: SubscriptionsStep) => {
    if (!availability[target]) return;
    setChosen(target);
    if (target === 'reveal' && reveal.miss !== null) emit({ name: 'subs_revealed', props: { miss: reveal.miss } }, 'subs:revealed');
  };
  /** The nearest available step before (-1) or after (1) this one. */
  const move = (direction: 1 | -1) => {
    for (let i = STEP_ORDER.indexOf(step) + direction; i >= 0 && i < STEP_ORDER.length; i += direction) {
      const candidateStep = STEP_ORDER[i]!;
      if (availability[candidateStep]) return goTo(candidateStep);
    }
  };

  // ----- statement ---------------------------------------------------------------------------------
  const [upload, setUpload] = useState<{ status: 'idle' | 'reading' | 'error'; error: StatementErrorVM | null }>({ status: 'idle', error: null });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const uploadStatement = useCallback(
    (file: File) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setUpload({ status: 'reading', error: null });
      emit({ name: 'subs_started', props: { path: 'statement' } }, 'subs:started:statement');
      readStatementForAudit(file, { categorize, anonId: getAnonId(), signal: controller.signal }).then(
        ({ items, classes }) => {
          if (controller.signal.aborted) return;
          try {
            const classOf = classes
              ? ((map) => (label: string): StatementClass | undefined => map.get(label))(new Map(classes.map((c) => [c.label, c.class])))
              : undefined;
            const audit = detectSubscriptions(items, { classOf, catalogue });
            const ids = new Set(audit.findings.map((f) => f.id));
            update((s) => ({
              ...s,
              audit,
              // A choice about a finding that is not in the new audit has nothing to apply to. The marks are
              // kept as made and resolved against the new audit; the write drops those that no longer count.
              confirmed: s.confirmed.filter((id) => ids.has(id)),
              dismissed: s.dismissed.filter((id) => ids.has(id)),
            }));
            setUpload({ status: 'idle', error: null });
            setChosen('findings');
            const flagged = audit.findings.filter((f) => f.flags.length > 0).length;
            if (flagged > 0) emit({ name: 'subs_flagged', props: { count: flagged } });
          } catch (err) {
            setUpload({ status: 'error', error: toVMError(err) });
          }
        },
        (err: unknown) => {
          if (controller.signal.aborted) return;
          setUpload({ status: 'error', error: toStatementError(err) });
        },
      );
    },
    [categorize, catalogue, update, emit, setChosen],
  );
  const dismissError = useCallback(() => setUpload({ status: 'idle', error: null }), []);

  const monthsCovered = state.audit?.monthsCovered ?? 0;
  const statement: StatementVM = {
    status: upload.status === 'idle' ? (hasAudit ? 'done' : 'idle') : upload.status,
    error: upload.error,
    monthsCovered,
    // Fewer months than charges the detector needs for a pattern: a monthly series cannot show in it.
    isShort: hasAudit && monthsCovered < subsMinCharges.value,
    asOf: state.audit?.asOf ?? null,
    upload: uploadStatement,
    dismissError,
  };

  // ----- findings ----------------------------------------------------------------------------------
  const forgotten = useMemo(() => {
    const tickedIds = new Set(tickAudit.findings.map((f) => f.serviceId));
    return new Set(forgottenIds(statementFindings, state.ticks.filter((t) => tickedIds.has(t.serviceId)), confirmed));
  }, [statementFindings, tickAudit, state.ticks, confirmed]);

  const findingsView: Omit<FindingsVM, 'confirm' | 'dismiss' | 'restoreDismissed'> = useMemo(() => {
    const toVM = (f: SubscriptionFinding): FindingVM => {
      const isCountedNow = isCounted(f, confirmed);
      return {
        id: f.id, name: displayNameOf(f, catalogue), label: f.label, serviceId: f.serviceId ?? null, category: f.category,
        cadence: f.cadence, amount: f.amount, monthly: f.monthly, yearly: f.yearly, chargesSeen: f.chargesSeen,
        lastCharge: f.lastCharge, nextExpected: f.nextExpected, status: f.status, flags: [...f.flags],
        previousAmount: f.previousAmount ?? null, overlapCount: f.overlapsWith?.length ?? 0, confidence: f.confidence,
        origin: f.origin, isEstimate: f.isEstimate, counted: isCountedNow, forgotten: forgotten.has(f.id),
        markedCancel: markedIds.has(f.id),
      };
    };
    const stopped = statementFindings.filter((f) => f.status === 'stopped');
    const toConfirm = statementFindings.filter((f) => f.status === 'active' && !isCounted(f, confirmed));
    const active = statementFindings.filter((f) => isCounted(f, confirmed));
    return {
      active: active.map(toVM), toConfirm: toConfirm.map(toVM), stopped: stopped.map(toVM),
      tickedOnly: merged.filter((f) => f.origin === 'tickList').map(toVM),
      found: active.length, monthly: statementTotals.monthlyTotal, yearly: statementTotals.yearlyTotal,
      ticked: tickAudit.findings.length, forgotten: forgotten.size,
      flagged: statementFindings.filter((f) => f.flags.length > 0).length,
      dismissedCount: state.dismissed.filter((id) => state.audit?.findings.some((f) => f.id === id)).length,
    };
  }, [statementFindings, merged, confirmed, markedIds, forgotten, statementTotals, tickAudit, catalogue, state.dismissed, state.audit]);

  const confirm = useCallback(
    (id: string) => {
      const f = latest.current.audit?.findings.find((x) => x.id === id);
      if (!f || f.status !== 'active' || f.confidence !== 'low' || latest.current.confirmed.includes(id)) return;
      update((s) => ({ ...s, confirmed: withId(s.confirmed, id), dismissed: without(s.dismissed, id) }));
    },
    [update],
  );
  const dismiss = useCallback(
    (id: string) => {
      if (!latest.current.audit?.findings.some((x) => x.id === id)) return;
      // The marks that point at the finding go with it (read before it is hidden: the ticked service it covered
      // would otherwise take the mark over), and bringing the finding back does not bring them back.
      update((s) => ({
        ...s, dismissed: withId(s.dismissed, id), confirmed: without(s.confirmed, id), cancelMarked: marksWithout(s, catalogue, id),
      }));
    },
    [update, catalogue],
  );
  const restoreDismissed = useCallback(() => update((s) => ({ ...s, dismissed: [] })), [update]);

  // ----- plan: the saving and its 10-year effect ---------------------------------------------------
  const saving = useMemo(() => {
    if (marked.length === 0) return null;
    const { monthlyTotal, yearlyTotal } = auditTotals(marked, confirmed);
    // An estimate wherever a marked line is one: a ticked price, or a charge not yet seen often enough to be sure of.
    return { monthly: monthlyTotal, yearly: yearlyTotal, isEstimate: marked.some((f) => f.isEstimate || f.confidence !== 'high') };
  }, [marked, confirmed]);
  const savingMonthly = saving?.monthly ?? null;

  const candidate = useMemo(
    () => (savingMonthly === null ? null : cancelCandidate(profile, savingMonthly)),
    [profile, savingMonthly],
  );
  const markCancel = useCallback(
    (id: string) => {
      const now = combineFindings(latest.current, catalogue);
      if (!now.merged.some((f) => f.id === id && isCounted(f, now.confirmed))) return;
      if (markedFindings(latest.current, catalogue).some((f) => f.id === id)) return; // already marked, maybe through its ticked service
      update((s) => ({ ...s, cancelMarked: withId(s.cancelMarked, id) }));
      emit({ name: 'subs_cancel_marked', props: { count: markedFindings(latest.current, catalogue).length } });
    },
    [catalogue, update, emit],
  );
  // Takes off every mark that points at the finding, the one made on it and the one made through its ticked service.
  const unmarkCancel = useCallback(
    (id: string) => update((s) => ({ ...s, cancelMarked: marksWithout(s, catalogue, id) })),
    [update, catalogue],
  );

  const profileSubscriptions = profile.spending.subscriptions;
  // The committed move is a snapshot: its patch is absolute and was sized for the marks and the subscriptions
  // line of that moment. It is "added" only while the plan would commit the same patch today.
  const cancelPlanCommitted = profile.committedMoveId === CANCEL_MOVE_ID && committedMove?.id === CANCEL_MOVE_ID;
  const moveAdded = cancelPlanCommitted && candidate !== null && patchesEqual(committedMove.patch, candidate.patch);
  const plan: PlanVM = {
    options: findingsView.active.concat(findingsView.tickedOnly).filter((f) => f.counted),
    markedCount: marked.length,
    saving,
    candidate,
    profileSubscriptions: { value: profileSubscriptions.value, isEstimate: profileSubscriptions.isEstimate },
    // Whole cents, so $29.98 marked against $29.98 held is covered.
    profileCovers: saving === null || Math.round(profileSubscriptions.value * 100) >= Math.round(saving.monthly * 100),
    isSampleProfile: profileOrigin === 'demo',
    markCancel,
    unmarkCancel,
    moveAdded,
    moveOutdated: cancelPlanCommitted && !moveAdded,
  };

  // ----- apply to the profile ---------------------------------------------------------------------
  const anEstimateIsCounted = counted.some((f) => f.isEstimate);
  const applyTotal = mergedTotals.monthlyTotal;
  const apply: ApplyVM = {
    canApply: counted.length > 0 && applyTotal > 0,
    from: { value: profileSubscriptions.value, isEstimate: profileSubscriptions.isEstimate },
    to: { value: applyTotal, isEstimate: anEstimateIsCounted },
    inPlan:
      subscriptionsDetected
      && Math.round(profileSubscriptions.value * 100) === Math.round(applyTotal * 100)
      && profileSubscriptions.isEstimate === anEstimateIsCounted,
    applyToProfile: () => {
      if (counted.length === 0 || !(applyTotal > 0)) return;
      applySubscriptionsAudit(applyTotal, !anEstimateIsCounted);
    },
  };

  // ----- renewals calendar -------------------------------------------------------------------------
  const [exported, setExported] = useState<DownloadOutcome | null>(null);
  const renewalItems = useMemo(
    // The calendar shows the service's own name, not the masked statement label.
    () => renewalsFromFindings(statementFindings.map((f) => ({ ...f, label: displayNameOf(f, catalogue) })), { confirmed }),
    [statementFindings, catalogue, confirmed],
  );
  const renewals: RenewalsVM = {
    count: renewalItems.length,
    canExport: renewalItems.length > 0,
    outcome: exported,
    exportCalendar: () => {
      if (renewalItems.length === 0) return;
      setExported(downloadRenewals(renewalItems));
    },
  };

  // ----- local data --------------------------------------------------------------------------------
  const clearLocalData = useCallback(() => {
    abort.current?.abort();
    latest.current = emptyToolState();
    clear();
    setChosen('guess');
    setUpload({ status: 'idle', error: null });
    setExported(null);
  }, [clear, setChosen]);

  return {
    status: ready ? 'ready' : 'loading',
    step,
    steps,
    goTo,
    next: () => move(1),
    back: () => move(-1),
    guess: { value: state.guess ?? null, presets: GUESS_PRESETS, set: setGuess },
    ticks: { ...ticksView, toggle: toggleTick },
    canReveal,
    reveal,
    statement,
    findings: { ...findingsView, confirm, dismiss, restoreDismissed },
    plan,
    apply,
    renewals,
    hasLocalData: saved !== undefined,
    clearLocalData,
  };
}
