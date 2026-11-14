// Strings for S10's "Coming up" card: future life events (raise, kid, move, big purchase, or anything
// else). Owner: Amir. Functions take values already formatted by the UI (formatMoney / formatMonthYear).
import type { CostCategory, LifeEventKind, LifeEventPreset } from '@lifeguessr/types';
import { common } from './common';

type EventShape = { kind: LifeEventKind; preset?: LifeEventPreset; category?: CostCategory; direction?: 'cost' | 'income' };

const presetLabels: Record<LifeEventPreset, string> = {
  raise: 'A raise',
  kid: 'A kid',
  move: 'A move',
  bigPurchase: 'A big purchase',
};

const category = (c: CostCategory | undefined) => (c ? common.categories[c] : common.categories.other);

/** What an event is called in the list: its shortcut's name, else its kind (and category or direction). */
function label(e: EventShape): string {
  if (e.preset) return presetLabels[e.preset];
  switch (e.kind) {
    case 'pay':
      return 'New take-home pay';
    case 'spending':
      return `${category(e.category)} changes`;
    case 'oneOff':
      return e.direction === 'income' ? 'One-off income' : 'One-off cost';
  }
}

export const lifeEvents = {
  title: 'Coming up',
  intro: 'Add changes you expect. The forecast, your moves, goals and Can I Afford It? all follow them.',
  todaysDollars: 'Amounts are in today’s dollars.',
  empty: 'Nothing planned yet. Start with one of these:',
  shortcuts: {
    raise: 'A raise',
    kid: 'A kid',
    move: 'A move',
    bigPurchase: 'A big purchase',
  } satisfies Record<LifeEventPreset, string>,
  custom: 'Something else',
  full: (max: number) => `You can plan up to ${max} changes. Remove one to add another.`,

  label,
  /** The line under an event's name: "$6,500/mo take-home from March 2027". */
  detail: (e: EventShape, amount: string, month: string): string => {
    switch (e.kind) {
      case 'pay':
        return `${amount}/mo take-home from ${month}`;
      case 'spending':
        return `${category(e.category)} ${amount}/mo from ${month}`;
      case 'oneOff':
        return `${amount} ${e.direction === 'income' ? 'coming in' : 'spent'} in ${month}`;
    }
  },
  edit: 'Edit',
  remove: 'Remove',
  /** Accessible names, so each row's buttons say which event they act on. */
  editLabel: (name: string, month: string) => `Edit ${name.toLowerCase()} in ${month}`,
  removeLabel: (name: string, month: string) => `Remove ${name.toLowerCase()} in ${month}`,

  form: {
    addTitle: (name: string) => `Add: ${name.toLowerCase()}`,
    editTitle: (name: string) => `Edit: ${name.toLowerCase()}`,
    month: 'Starting month',
    oneOffMonth: 'Month',
    kindLegend: 'What changes',
    kinds: { pay: 'My pay', spending: 'A monthly cost', oneOff: 'A one-off' } satisfies Record<LifeEventKind, string>,
    category: 'Which cost',
    directionLegend: 'Money',
    directions: { cost: 'Going out', income: 'Coming in' },
    amount: {
      pay: 'Take-home pay per month',
      spending: (c: CostCategory) => `${common.categories[c]} per month`,
      oneOff: 'Amount',
    },
    payHint: 'Your whole monthly take-home from then on, not the increase. $0 means no pay (a break or leaving a job).',
    spendingHint: 'The new monthly amount from then on. $0 means the cost ends.',
    moveHint: 'Your new rent and utilities per month.',
    kidHint: {
      area: 'Prefilled with infant daycare in your area, added to the childcare you already have.',
      median: (areas: number) =>
        `Prefilled with infant daycare, the median of our ${areas} areas (we have no figure for your ZIP), added to the childcare you already have.`,
    },
    save: 'Save',
    add: 'Add',
    cancel: 'Cancel',
  },
  errors: {
    month: {
      missing: 'Pick a month.',
      past: 'Pick a month from next month on. Changes that already started belong in your numbers.',
      tooFar: (years: number) => `Pick a month within ${years} years.`,
    },
    amount: {
      missing: 'Enter an amount.',
      negative: 'Enter $0 or more.',
      zero: 'Enter an amount above $0.',
      tooLarge: (max: string) => `Enter at most ${max}.`,
    },
  },

  /** One line per event that started and became part of today's numbers (or, for a one-off, passed). */
  folded: (e: EventShape, month: string): string => {
    const passed = 'so we took it off the list. Update your cash if it changed.';
    switch (e.preset) {
      case 'raise':
        return `Your raise started in ${month}, so we updated your take-home pay.`;
      case 'kid':
        return `Childcare for your kid started in ${month}, so we updated childcare.`;
      case 'move':
        return `Your move happened in ${month}, so we updated rent + utilities.`;
      case 'bigPurchase':
        return `Your big purchase was due in ${month}, ${passed}`;
      case undefined:
        break;
    }
    switch (e.kind) {
      case 'pay':
        return `Your new pay started in ${month}, so we updated your take-home pay.`;
      case 'spending':
        return `Your new ${category(e.category).toLowerCase()} amount started in ${month}, so we updated it.`;
      case 'oneOff':
        return `Your one-off ${e.direction === 'income' ? 'income' : 'cost'} was due in ${month}, ${passed}`;
    }
  },
  foldedDismiss: 'Got it',
} as const;
