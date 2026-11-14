// S10 "Coming up": the future life events the person expects (a raise, a kid, a move, a big purchase,
// or any pay, monthly cost or one-off change), dated by calendar month. They live on the Profile, so
// every engine consumer (the forecast, Next Moves, goals, Can I Afford It?, Loan Lab) follows them with
// no wiring of its own. Spec: docs/superpowers/specs/2026-11-15-life-events-design.md → Client.
//
// Only future events are added or edited (from next month): an event whose month has come is folded into
// today's numbers by the store (`foldStartedEvents`, run from useAppReady), and this hook shows the note
// for it once. Amounts are today's dollars; the kid shortcut's childcare figure is an estimate.
import { addMonths } from '@lifeguessr/engine';
import {
  COST_CATEGORIES, LIFE_EVENT_MAX_YEARS_AHEAD, MAX_LIFE_EVENTS,
  type LifeEvent, type LifeEventKind, type LifeEventPreset, type Money, type Profile, type YearMonth,
} from '@lifeguessr/types';
import { useCallback, useEffect, useMemo } from 'react';
import { lifeEvents as copy } from '@/copy';
import { infantChildcareFor } from '@/lib/areas';
import { track } from '@/lib/events';
import { formatMonthYear } from '@/lib/format';
import { useAppReady, useAppStore, useCurrentMonth, useProfile, type FoldedNote, type LifeEventCategory } from '@/state';
import { newUuid } from '@/state/anonId';
import { MONTHLY_SPENDING_SANITY_CAP } from '@/state/store';
import type {
  FoldedNoteVM, KidChildcareVM, LifeEventDraft, LifeEventErrors, LifeEventShortcutVM, LifeEventsVM, LifeEventVM,
} from './types';

/** How far ahead a shortcut's month is prefilled. */
const SHORTCUT_MONTHS_AHEAD = 12;

/**
 * Sanity caps per kind, the same as the balance sheet's (S8): take-home pay and a monthly category up to
 * $1M a month (MONTHLY_SPENDING_SANITY_CAP), a one-off up to the largest cash balance ($100M).
 */
export const LIFE_EVENT_AMOUNT_MAX = {
  pay: 1_000_000,
  spending: MONTHLY_SPENDING_SANITY_CAP,
  oneOff: 100_000_000,
} as const satisfies Record<LifeEventKind, Money>;

/** The kind and category each shortcut makes. */
const PRESET_KIND = { raise: 'pay', kid: 'spending', move: 'spending', bigPurchase: 'oneOff' } as const satisfies Record<
  LifeEventPreset,
  LifeEventKind
>;
const PRESET_CATEGORY: Partial<Record<LifeEventPreset, LifeEventCategory>> = { kid: 'childcare', move: 'rentUtilities' };
const PRESETS = ['raise', 'kid', 'move', 'bigPurchase'] as const satisfies readonly LifeEventPreset[];

/** Every category but debt payments, in the app's order. */
const CATEGORIES = COST_CATEGORIES.filter((c): c is LifeEventCategory => c !== 'debtPayments');

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The draft's preset when it still describes it (same kind and, for kid and move, category); else none. */
function fittingPreset(d: LifeEventDraft): LifeEventPreset | undefined {
  const p = d.preset;
  if (p === undefined || PRESET_KIND[p] !== d.kind) return undefined;
  const category = PRESET_CATEGORY[p];
  return category === undefined || category === d.category ? p : undefined;
}

/** The engine event for a valid draft. The kid shortcut's childcare figure is our estimate; the rest are the person's. */
function toEvent(id: string, d: LifeEventDraft, month: YearMonth, amount: Money): LifeEvent {
  const preset = fittingPreset(d);
  const base = { id, month, ...(preset ? { preset } : {}) };
  const value = { value: amount, isEstimate: preset === 'kid' };
  switch (d.kind) {
    case 'pay':
      return { ...base, kind: 'pay', takeHomePay: value };
    case 'spending':
      return { ...base, kind: 'spending', category: d.category, monthly: value };
    case 'oneOff':
      return { ...base, kind: 'oneOff', amount, direction: d.direction };
  }
}

function amountOf(e: LifeEvent): { amount: Money; isEstimate: boolean } {
  switch (e.kind) {
    case 'pay':
      return { amount: e.takeHomePay.value, isEstimate: e.takeHomePay.isEstimate };
    case 'spending':
      return { amount: e.monthly.value, isEstimate: e.monthly.isEstimate };
    case 'oneOff':
      return { amount: e.amount, isEstimate: false };
  }
}

function eventVM(e: LifeEvent): LifeEventVM {
  const { amount, isEstimate } = amountOf(e);
  const category = e.kind === 'spending' ? e.category : undefined;
  const direction = e.kind === 'oneOff' ? e.direction : undefined;
  return {
    id: e.id,
    kind: e.kind,
    ...(e.preset ? { preset: e.preset } : {}),
    label: copy.label({ kind: e.kind, preset: e.preset, category, direction }),
    month: e.month,
    amount,
    isEstimate,
    ...(category ? { category } : {}),
    ...(direction ? { direction } : {}),
    draft: {
      kind: e.kind,
      ...(e.preset ? { preset: e.preset } : {}),
      month: e.month,
      amount,
      category: category ?? 'other',
      direction: direction ?? 'cost',
    },
  };
}

/** By month; events in the same month keep their list order (Array.prototype.sort is stable). */
const byMonth = (a: LifeEvent, b: LifeEvent) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0);

/**
 * Childcare in effect before a new kid: the latest planned childcare amount (latest month, then the
 * later one in the list: what the engine applies last), else today's. A second kid adds to the first.
 */
function childcareBeforeNewKid(p: Profile): Money {
  const planned = (p.events ?? []).filter((e) => e.kind === 'spending' && e.category === 'childcare').sort(byMonth);
  const last = planned.at(-1);
  return last?.kind === 'spending' ? last.monthly.value : p.spending.childcare.value;
}

function kidChildcare(zip: string | undefined): KidChildcareVM {
  const c = infantChildcareFor(zip);
  return c.basis === 'area'
    ? { basis: 'area', infantMonthly: c.monthly, source: c.source }
    : { basis: 'median', infantMonthly: c.monthly, source: c.source, areaCount: c.areaCount };
}

function shortcutsFor(p: Profile, month: YearMonth): LifeEventShortcutVM[] {
  const blank = { month, category: 'other', direction: 'cost' } as const;
  const kid = kidChildcare(p.zip);
  const amounts: Record<LifeEventPreset, Money | null> = {
    raise: p.takeHomePay.value,
    kid: childcareBeforeNewKid(p) + kid.infantMonthly,
    move: p.spending.rentUtilities.value,
    bigPurchase: null,
  };
  return PRESETS.map((preset) => ({
    preset,
    draft: { ...blank, kind: PRESET_KIND[preset], preset, amount: amounts[preset], category: PRESET_CATEGORY[preset] ?? 'other' },
    ...(preset === 'kid' ? { childcare: kid } : {}),
  }));
}

/** Errors in a draft, given the first and last months an event may start in. */
export function validateDraft(d: LifeEventDraft, range: { min: YearMonth; max: YearMonth }): LifeEventErrors | null {
  const errors: LifeEventErrors = {};
  if (!YEAR_MONTH.test(d.month)) errors.month = 'missing';
  else if (d.month < range.min) errors.month = 'past';
  else if (d.month > range.max) errors.month = 'tooFar';

  const a = d.amount;
  if (a === null || !Number.isFinite(a)) errors.amount = 'missing';
  else if (a < 0) errors.amount = 'negative';
  else if (a === 0 && d.kind === 'oneOff') errors.amount = 'zero';
  else if (a > LIFE_EVENT_AMOUNT_MAX[d.kind]) errors.amount = 'tooLarge';

  return errors.month || errors.amount ? errors : null;
}

function noteVM(n: FoldedNote): FoldedNoteVM {
  const shape = {
    kind: n.kind,
    preset: n.preset,
    category: n.kind === 'spending' ? n.category : undefined,
    direction: n.kind === 'oneOff' ? n.direction : undefined,
  };
  return { ...n, text: copy.folded(shape, formatMonthYear(n.month)) };
}

export function useLifeEvents(): LifeEventsVM {
  const ready = useAppReady();
  const profile = useProfile();
  const thisMonth = useCurrentMonth();

  const monthRange = useMemo(
    () => ({ min: addMonths(thisMonth, 1), max: addMonths(thisMonth, 12 * LIFE_EVENT_MAX_YEARS_AHEAD) }),
    [thisMonth],
  );
  const events = useMemo(() => [...(profile.events ?? [])].sort(byMonth).map(eventVM), [profile.events]);
  const shortcutMonth = addMonths(thisMonth, SHORTCUT_MONTHS_AHEAD);
  const shortcuts = useMemo(() => shortcutsFor(profile, shortcutMonth), [profile, shortcutMonth]);
  const custom = useMemo<LifeEventDraft>(
    () => ({ kind: 'spending', month: shortcutMonth, amount: null, category: 'other', direction: 'cost' }),
    [shortcutMonth],
  );

  const validate = useCallback((d: LifeEventDraft) => validateDraft(d, monthRange), [monthRange]);

  const add = useCallback(
    (d: LifeEventDraft): LifeEventErrors | null => {
      const errors = validate(d);
      if (errors) return errors;
      const event = toEvent(newUuid(), d, d.month as YearMonth, d.amount!);
      if (useAppStore.getState().addLifeEvent(event)) {
        track({ name: 'life_event_added', props: { kind: event.kind, ...(event.preset ? { preset: event.preset } : {}) } });
      }
      return null;
    },
    [validate],
  );

  const update = useCallback(
    (id: string, d: LifeEventDraft): LifeEventErrors | null => {
      const errors = validate(d);
      if (errors) return errors;
      useAppStore.getState().updateLifeEvent(id, toEvent(id, d, d.month as YearMonth, d.amount!));
      return null;
    },
    [validate],
  );

  const remove = useCallback((id: string) => useAppStore.getState().removeLifeEvent(id), []);

  // Folded notes show once: when they arrive, they move out of the saved state onto the screen.
  const pending = useAppStore((s) => s.foldedNotes.length);
  useEffect(() => {
    if (pending > 0) useAppStore.getState().showFoldedNotes();
  }, [pending]);
  const shown = useAppStore((s) => s.foldedNotesShown);
  const foldedNotes = useMemo(() => shown.map(noteVM), [shown]);
  const dismissFolded = useCallback(() => useAppStore.getState().dismissFoldedNotes(), []);

  const count = profile.events?.length ?? 0;
  return {
    status: ready ? 'ready' : 'loading',
    events,
    shortcuts,
    custom,
    monthRange,
    maxYearsAhead: LIFE_EVENT_MAX_YEARS_AHEAD,
    amountMax: LIFE_EVENT_AMOUNT_MAX,
    categories: CATEGORIES,
    canAdd: count < MAX_LIFE_EVENTS,
    maxEvents: MAX_LIFE_EVENTS,
    validate,
    add,
    update,
    remove,
    foldedNotes,
    dismissFolded,
  };
}
