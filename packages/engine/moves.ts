// Y3 (Amir): Next Moves. Spec: docs/ENGINEERING.md → Next Moves.
//
// Level 1 candidates, each a ProfilePatch whose 10-year effect is measured with the forecast:
//   effect10y = forecast(applyPatch(p, patch)).in10y.mid − forecast(p).in10y.mid,
// both in today's dollars with the same rates (what S10 shows; the ranking is the same in nominal
// dollars because both forecasts share one deflator).
// - payCardFirst:        extra monthly payment on the highest-APR card with a balance.
//                        Size: payCardExtraShareOfSurplus × this month's surplus, rounded down to a
//                        multiple of payCardExtraStep, capped by the card balance. No surplus → none.
// - cutCategory:         the largest discretionary category (eatingOut, subscriptions, other) × (1 −
//                        cutCategoryShare). When cancelSubscriptions is offered, subscriptions is left
//                        to that move, so two cards never target the same line.
// - cancelSubscriptions: only when the caller says a statement detected subscriptions
//                        (`opts.subscriptionsDetected`). The Profile has no statement flag and
//                        `isEstimate: false` also means "typed in the Quick Sliders", so it can't tell.
//
// rankMoves is `rankCandidates(p, moveCandidates(p, opts), rulesEffect)`. The split lets the AI
// forecast path rank the same candidates by its own effects (the candidates and the ranking rules
// stay the engine's; only the effect numbers come from elsewhere).
//
// Ids are stable: `payCardFirst:<debt id>`, `cutCategory:<category>`, `cancelSubscriptions`.
// Done moves (`doneMoveIds`) never come back; the next candidate of that kind takes their place
// (the next card by APR, the next largest category). The committed move (`committedMoveId`) is
// always returned while it still applies and helps: if it falls outside the top 3 it takes the
// third slot (the list stays sorted). The UI flags it with `move.id === p.committedMoveId`.
//
// Unlocking: level 2 opens once a level 1 move is done or committed (the check-in that the spec
// also asks for is a mock for the hackathon). Level 2 kinds need inputs the profile doesn't have
// (employer match, insurance quote), so they stay in the mock path and are never generated here.
import type { CostCategory, Money, Move, MoveKind, Profile, ProfilePatch } from '@lifeguessr/types';
import { MOVE_KINDS } from '@lifeguessr/types';
import {
  cancelSubscriptionsShare,
  cutCategoryShare,
  payCardExtraShareOfSurplus,
  payCardExtraStep,
} from './assumptions';
import { type ForecastOptions, applyPatch, forecast } from './forecast';
import { type ForecastRates, simulate } from './simulate';

export type RankMovesOptions = {
  /** Same overrides as the forecast screen, e.g. `{ inflationAnnual: inflationAnnualOf(area) }`. */
  rates?: Partial<ForecastRates>;
  /** A statement upload found subscription charges. Enables cancelSubscriptions. Default false. */
  subscriptionsDetected?: boolean;
};

/** How many moves rankMoves returns at most. */
export const MOVES_SHOWN = 3;

/** Level of each move kind (ENGINEERING.md → Next Moves). */
export const MOVE_LEVELS = {
  payCardFirst: 1,
  cutCategory: 1,
  cancelSubscriptions: 1,
  retirementMatch: 2,
  hsa: 2,
  refinance: 2,
  negotiateRent: 2,
  reshopInsurance: 2,
} as const satisfies Record<MoveKind, Move['level']>;

/** Categories cutCategory may cut, in tie-break order. */
export const DISCRETIONARY_CATEGORIES = ['eatingOut', 'subscriptions', 'other'] as const satisfies readonly CostCategory[];

/** Effects below this many dollars (they show as $0) are dropped, along with floating-point dust. */
export const MIN_EFFECT_10Y: Money = 1;

/** Tie-break order when two moves have the same effect. */
const KIND_ORDER: readonly MoveKind[] = MOVE_KINDS;

/** The kind encoded in a move id (`'payCardFirst:card-1'` → `'payCardFirst'`), or undefined. */
export function moveKindOf(id: string): MoveKind | undefined {
  const prefix = id.split(':', 1)[0];
  return (MOVE_KINDS as readonly string[]).includes(prefix ?? '') ? (prefix as MoveKind) : undefined;
}

/** True when the id names a level 1 move. */
function isLevel1Id(id: string | undefined): boolean {
  const kind = id === undefined ? undefined : moveKindOf(id);
  return kind !== undefined && MOVE_LEVELS[kind] === 1;
}

/** Highest unlocked move level: 2 once a level 1 move is done or committed, else 1. */
export function movesLevel(p: Pick<Profile, 'doneMoveIds' | 'committedMoveId'>): 1 | 2 {
  return p.doneMoveIds.some(isLevel1Id) || isLevel1Id(p.committedMoveId) ? 2 : 1;
}

/** Whether moves of `level` are unlocked for the profile. Level 3 has no rule yet: locked. */
export function isLevelUnlocked(p: Pick<Profile, 'doneMoveIds' | 'committedMoveId'>, level: Move['level']): boolean {
  return level <= movesLevel(p);
}

/** A move that has not been measured yet: everything but its 10-year effect. */
export type MoveCandidate = Omit<Move, 'effect10y'>;

/** payCardFirst for every card with a balance, highest APR first (ties: profile order). */
function payCardFirstCandidates(p: Profile, rates: Partial<ForecastRates> | undefined): MoveCandidate[] {
  const cards = p.debts
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.kind === 'card' && d.balance > 0)
    .sort((a, b) => b.d.apr - a.d.apr || a.i - b.i)
    .map(({ d }) => d);
  if (cards.length === 0) return [];

  // This month's surplus as the forecast computes it (after spending, minimums and current extras).
  const surplus = simulate(p, 1, { rates }).path[1]!.surplus;
  if (!(surplus > 0)) return [];
  const step = payCardExtraStep.value;
  const extra = Math.floor((surplus * payCardExtraShareOfSurplus.value) / step) * step;
  if (extra <= 0) return [];

  return cards.map((d) => ({
    id: `payCardFirst:${d.id}`,
    kind: 'payCardFirst',
    level: 1,
    patch: { debts: [{ id: d.id, extraPayment: (d.extraPayment ?? 0) + Math.min(extra, d.balance) }] },
  }));
}

function cutCategoryCandidates(p: Profile, excluded: ReadonlySet<CostCategory>): MoveCandidate[] {
  return DISCRETIONARY_CATEGORIES
    .filter((c) => !excluded.has(c) && p.spending[c].value > 0)
    .map((c, i) => ({ c, i, value: p.spending[c].value }))
    .sort((a, b) => b.value - a.value || a.i - b.i)
    .map(({ c, value }) => ({
      id: `cutCategory:${c}`,
      kind: 'cutCategory',
      level: 1,
      category: c,
      patch: { spending: { [c]: value * (1 - cutCategoryShare.value) } } satisfies ProfilePatch,
    }));
}

function cancelSubscriptionsCandidate(p: Profile, detected: boolean): MoveCandidate[] {
  const value = p.spending.subscriptions.value;
  if (!detected || !(value > 0)) return [];
  return [{
    id: 'cancelSubscriptions',
    kind: 'cancelSubscriptions',
    level: 1,
    category: 'subscriptions',
    patch: { spending: { subscriptions: value * (1 - cancelSubscriptionsShare.value) } },
  }];
}

/**
 * The level 1 moves that apply to the profile, not yet measured: per kind the best open candidate
 * (plus the committed one when it is another of that kind), and cancelSubscriptions when a
 * statement found subscriptions. Done moves are left out. Order: payCardFirst, cutCategory,
 * cancelSubscriptions. Pure: the profile is not mutated. See the header.
 */
export function moveCandidates(p: Profile, opts: RankMovesOptions = {}): MoveCandidate[] {
  const done = new Set(p.doneMoveIds);
  const open = (c: MoveCandidate) => !done.has(c.id);
  // Per kind: the best open candidate, plus the committed one if it is another of that kind.
  const pick = (list: MoveCandidate[]) => {
    const openList = list.filter(open);
    const first = openList[0];
    const committed = openList.find((c) => c.id === p.committedMoveId);
    return [first, committed !== first ? committed : undefined].filter((c): c is MoveCandidate => c !== undefined);
  };

  const cancel = cancelSubscriptionsCandidate(p, opts.subscriptionsDetected ?? false).filter(open);
  const excluded = new Set<CostCategory>(cancel.length > 0 ? ['subscriptions'] : []);
  return [
    ...pick(payCardFirstCandidates(p, opts.rates)),
    ...pick(cutCategoryCandidates(p, excluded)),
    ...cancel,
  ];
}

/**
 * Ranks measured candidates: `effectOf` gives the effect to rank each candidate by (the 10-year effect
 * in `rankMoves`; the web app passes the effect at the horizon picked on S10). Effects below
 * MIN_EFFECT_10Y ($1, applied to that effect whatever year it is for) and NaN are dropped, the rest
 * sorted by effect descending (ties: kind order, then id), at most MOVES_SHOWN. The committed move is
 * always kept while it survives the filter: outside the top 3 it takes the third slot (the list stays
 * sorted). `effectOf` runs once per candidate. Each returned move's `effect10y` holds what `effectOf`
 * returned, so a caller that ranks by another year puts the real 10-year effect back.
 */
export function rankCandidates(
  p: Profile,
  candidates: readonly MoveCandidate[],
  effectOf: (c: MoveCandidate) => Money,
): Move[] {
  const ranked: Move[] = candidates
    .map((c) => ({ ...c, effect10y: effectOf(c) }))
    .filter((m) => m.effect10y >= MIN_EFFECT_10Y)
    .sort((a, b) =>
      b.effect10y - a.effect10y ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const top = ranked.slice(0, MOVES_SHOWN);
  const committed = ranked.find((m) => m.id === p.committedMoveId);
  if (committed && !top.includes(committed)) top[MOVES_SHOWN - 1] = committed;
  return top;
}

/**
 * Level 1 moves for the profile, sorted by `effect10y` (today's dollars, descending), at most
 * MOVES_SHOWN. Moves that are done, don't apply, or don't raise net worth in 10 years are left out.
 * Pure: the profile is not mutated. See the header for the candidates and the committed move.
 */
export function rankMoves(p: Profile, opts: RankMovesOptions = {}): Move[] {
  const forecastOpts: ForecastOptions = { todaysDollars: true, rates: opts.rates };
  // The base forecast is computed once, on the first measurement: no candidates, no forecast.
  let base: Money | undefined;
  const rulesEffect = (c: MoveCandidate): Money => {
    base ??= forecast(p, 10, forecastOpts).in10y.mid;
    return forecast(applyPatch(p, c.patch), 10, forecastOpts).in10y.mid - base;
  };
  return rankCandidates(p, moveCandidates(p, opts), rulesEffect);
}
