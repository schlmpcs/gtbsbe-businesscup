// rankMoves() and the unlock helpers (Y3). Most cases run with every rate at 0 (no inflation, no
// cash yield, no investment return), so a monthly saving of $s is worth exactly 120 × s in 10 years
// and the expected effects can be checked by hand.
import { describe, expect, it, vi } from 'vitest';
import type { Debt, Money, Move, Profile } from '@lifeguessr/types';
import { areaByZip, cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import { applyPatch, forecast } from './forecast';
import type * as ForecastModule from './forecast';
import {
  DISCRETIONARY_CATEGORIES, MOVES_SHOWN, MOVE_LEVELS, type MoveCandidate, isLevelUnlocked, moveCandidates,
  moveKindOf, movesLevel, rankCandidates, rankMoves,
} from './moves';
import { type ForecastRates, inflationAnnualOf } from './simulate';

// forecast() is wrapped, not replaced: every test still gets the real result, and one test below
// counts the calls rankMoves makes.
vi.mock('./forecast', async (importOriginal) => {
  const actual = await importOriginal<typeof ForecastModule>();
  return { ...actual, forecast: vi.fn(actual.forecast) };
});

const ZERO_RATES: Partial<ForecastRates> = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0 };
const m = (v: number) => ({ value: v, isEstimate: false });

/** Every field measured; $5,000 take-home, $2,800 spending (rent 2,000 + eating out 400 + subs 100 + other 300). */
function profile(over: Partial<Profile> = {}, spending: Partial<Record<keyof Profile['spending'], number>> = {}): Profile {
  const s = { rentUtilities: 2000, car: 0, childcare: 0, groceries: 0, eatingOut: 400, subscriptions: 100, debtPayments: 0, other: 300, ...spending };
  return {
    age: m(30), takeHomePay: m(5000),
    spending: Object.fromEntries(Object.entries(s).map(([c, v]) => [c, m(v)])) as Profile['spending'],
    cash: m(1000), retirement: m(0), retirementShare: m(0),
    debts: [], doneMoveIds: [],
    ...over,
  };
}

function card(id: string, apr: number, balance: number, minPayment: number, extraPayment?: number): Debt {
  return { id, kind: 'card', apr, balance, minPayment: m(minPayment), ...(extraPayment !== undefined && { extraPayment }) };
}

/** The spec formula, independently: effect = forecast(with patch).in10y.mid − forecast(p).in10y.mid. */
function specEffect(p: Profile, move: Move, rates?: Partial<ForecastRates>): number {
  const opts = { todaysDollars: true, rates };
  return forecast(applyPatch(p, move.patch), 10, opts).in10y.mid - forecast(p, 10, opts).in10y.mid;
}

const ids = (moves: Move[]) => moves.map((x) => x.id);
const payMove = (p: Profile) => rankMoves(p, { rates: ZERO_RATES }).find((x) => x.kind === 'payCardFirst');

/** Profiles are plain JSON data (the engine has no DOM/Node types, so no structuredClone). */
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

describe('rankMoves: cutCategory', () => {
  it('no card → no payCardFirst; cuts the largest discretionary category by 20%', () => {
    const moves = rankMoves(profile(), { rates: ZERO_RATES });
    expect(moves).toHaveLength(1);
    const [cut] = moves;
    expect(cut).toEqual({
      id: 'cutCategory:eatingOut', kind: 'cutCategory', level: 1, category: 'eatingOut',
      patch: { spending: { eatingOut: 320 } }, effect10y: expect.any(Number),
    });
    expect(cut!.effect10y).toBeCloseTo(80 * 120, 6); // $80/month saved for 120 months
  });

  it('picks whichever of eatingOut / subscriptions / other is largest', () => {
    const [cut] = rankMoves(profile({}, { other: 500 }), { rates: ZERO_RATES });
    expect(cut!.id).toBe('cutCategory:other');
    expect(cut!.patch).toEqual({ spending: { other: 400 } });
    expect(cut!.effect10y).toBeCloseTo(100 * 120, 6);

    const [subs] = rankMoves(profile({}, { subscriptions: 600 }), { rates: ZERO_RATES });
    expect(subs!.id).toBe('cutCategory:subscriptions');
    expect(subs!.category).toBe('subscriptions');
  });

  it('never cuts a non-discretionary category, even a larger one', () => {
    expect(DISCRETIONARY_CATEGORIES).toEqual(['eatingOut', 'subscriptions', 'other']);
    const moves = rankMoves(profile({}, { rentUtilities: 3000, groceries: 900 }), { rates: ZERO_RATES });
    expect(ids(moves)).toEqual(['cutCategory:eatingOut']);
  });

  it('breaks a tie by the order eatingOut, subscriptions, other', () => {
    expect(rankMoves(profile({}, { eatingOut: 300, other: 300 }), { rates: ZERO_RATES })[0]!.id).toBe('cutCategory:eatingOut');
  });

  it('no discretionary spending → nothing to cut', () => {
    expect(rankMoves(profile({}, { eatingOut: 0, subscriptions: 0, other: 0 }), { rates: ZERO_RATES })).toEqual([]);
  });
});

describe('rankMoves: cancelSubscriptions', () => {
  it('only when a statement detected subscriptions', () => {
    expect(ids(rankMoves(profile(), { rates: ZERO_RATES }))).not.toContain('cancelSubscriptions');
    const moves = rankMoves(profile(), { rates: ZERO_RATES, subscriptionsDetected: true });
    const cancel = moves.find((x) => x.kind === 'cancelSubscriptions')!;
    expect(cancel).toMatchObject({ id: 'cancelSubscriptions', level: 1, category: 'subscriptions', patch: { spending: { subscriptions: 50 } } });
    expect(cancel.effect10y).toBeCloseTo(50 * 120, 6); // half of $100/month cancelled
  });

  it('not when subscriptions are $0, even if a statement was uploaded', () => {
    const moves = rankMoves(profile({}, { subscriptions: 0 }), { rates: ZERO_RATES, subscriptionsDetected: true });
    expect(moves.map((x) => x.kind)).not.toContain('cancelSubscriptions');
  });

  it('takes subscriptions out of cutCategory so two moves never target one line', () => {
    const p = profile({}, { subscriptions: 600 });
    const moves = rankMoves(p, { rates: ZERO_RATES, subscriptionsDetected: true });
    expect(ids(moves)).toEqual(['cancelSubscriptions', 'cutCategory:eatingOut']);
    expect(moves[0]!.effect10y).toBeCloseTo(300 * 120, 6);
    expect(moves[1]!.effect10y).toBeCloseTo(80 * 120, 6);
  });
});

describe('rankMoves: payCardFirst', () => {
  it('pays extra on the highest-APR card: half the surplus, rounded down to $10', () => {
    const p = profile({ debts: [card('card-a', 0.18, 3000, 100), card('card-b', 0.29, 2000, 80)] });
    const pay = rankMoves(p, { rates: ZERO_RATES }).find((x) => x.kind === 'payCardFirst')!;
    // surplus = 5000 − 2800 − 100 − 80 = 2020 → × 0.5 = 1010
    expect(pay).toMatchObject({ id: 'payCardFirst:card-b', level: 1, patch: { debts: [{ id: 'card-b', extraPayment: 1010 }] } });
    expect(pay.category).toBeUndefined();
  });

  it('rounds the extra payment down to a multiple of $10', () => {
    const p = profile({ takeHomePay: m(5025.5), debts: [card('c', 0.2, 5000, 100)] });
    // surplus = 5025.5 − 2800 − 100 = 2125.5 → × 0.5 = 1062.75 → 1060
    expect(payMove(p)!.patch).toEqual({ debts: [{ id: 'c', extraPayment: 1060 }] });
  });

  it('caps the extra payment at the balance, and adds to an existing extra payment', () => {
    const small = profile({ debts: [card('c', 0.2, 600, 25)] });
    expect(payMove(small)!.patch).toEqual({ debts: [{ id: 'c', extraPayment: 600 }] });

    const withExtra = profile({ debts: [card('c', 0.2, 9000, 100, 200)] });
    // surplus = 5000 − 2800 − 100 − 200 = 1900 → 950 more on top of the 200 already paid
    expect(payMove(withExtra)!.patch).toEqual({ debts: [{ id: 'c', extraPayment: 1150 }] });
  });

  it('effect = the card interest it saves (by hand, 1%/month card)', () => {
    // $1,200 at 12% APR, $100/month minimum. Surplus 5500 − 2800 − 100 = 2600 → 1300, capped at the
    // $1,200 balance, which clears the card in month 1.
    const p = profile({ takeHomePay: m(5500), debts: [card('c', 0.12, 1200, 100)] });
    const pay = payMove(p)!;
    expect(pay.patch).toEqual({ debts: [{ id: 'c', extraPayment: 1200 }] });
    let balance = 1200;
    let interestBase = 0;
    while (balance > 1e-9) {
      const interest = balance * 0.01;
      interestBase += interest;
      balance = balance + interest - Math.min(100, balance + interest);
    }
    expect(pay.effect10y).toBeCloseTo(interestBase - 12, 6); // with the move: one month of interest
  });

  it('no card with a balance, or no surplus → no payCardFirst', () => {
    const paidOff = profile({ debts: [card('c', 0.25, 0, 0)] });
    expect(rankMoves(paidOff, { rates: ZERO_RATES }).map((x) => x.kind)).not.toContain('payCardFirst');

    const auto: Debt = { id: 'auto-1', kind: 'auto', apr: 0.09, balance: 15_000, minPayment: m(400) };
    expect(rankMoves(profile({ debts: [auto] }), { rates: ZERO_RATES }).map((x) => x.kind)).not.toContain('payCardFirst');

    const tight = profile({ takeHomePay: m(2900), debts: [card('c', 0.25, 3000, 100)] }); // surplus 0
    expect(rankMoves(tight, { rates: ZERO_RATES }).map((x) => x.kind)).not.toContain('payCardFirst');
  });

  it('drops a move that does not raise net worth (0% APR card with no cash yield: effect 0)', () => {
    const p = profile({ debts: [card('promo', 0, 3000, 100)] });
    expect(ids(rankMoves(p, { rates: ZERO_RATES }))).toEqual(['cutCategory:eatingOut']);
  });
});

describe('rankMoves: ranking', () => {
  const p = profile({ debts: [card('card-a', 0.18, 3000, 100), card('card-b', 0.29, 2000, 80)] }, { subscriptions: 200 });
  const opts = { rates: ZERO_RATES, subscriptionsDetected: true };

  it('sorts by effect10y descending; each effect is the spec formula', () => {
    const moves = rankMoves(p, opts);
    // cancel: $100/month → 12,000; cut eating out: $80/month → 9,600; card-b: interest saved (< $1,500)
    expect(ids(moves)).toEqual(['cancelSubscriptions', 'cutCategory:eatingOut', 'payCardFirst:card-b']);
    expect(moves[0]!.effect10y).toBeCloseTo(12_000, 6);
    expect(moves[1]!.effect10y).toBeCloseTo(9_600, 6);
    expect(moves[2]!.effect10y).toBeGreaterThan(0);
    expect(moves[2]!.effect10y).toBeLessThan(1_500);
    for (const move of moves) expect(move.effect10y).toBeCloseTo(specEffect(p, move, ZERO_RATES), 9);
    for (let i = 1; i < moves.length; i++) expect(moves[i - 1]!.effect10y).toBeGreaterThanOrEqual(moves[i]!.effect10y);
  });

  it(`returns at most ${MOVES_SHOWN}: a committed fourth candidate pushes out the weakest`, () => {
    const moves = rankMoves({ ...p, committedMoveId: 'cutCategory:other' }, opts); // other: $60/month → 7,200
    expect(ids(moves)).toEqual(['cancelSubscriptions', 'cutCategory:eatingOut', 'cutCategory:other']);
    expect(moves[2]!.effect10y).toBeCloseTo(7_200, 6);
  });

  it('keeps the committed move even when it ranks below the top 3 (third slot, still sorted)', () => {
    const moves = rankMoves({ ...p, committedMoveId: 'payCardFirst:card-a' }, opts);
    expect(ids(moves)).toEqual(['cancelSubscriptions', 'cutCategory:eatingOut', 'payCardFirst:card-a']);
    expect(moves[2]!.patch).toEqual({ debts: [{ id: 'card-a', extraPayment: 960 }] }); // (5000 − 2900 − 180) × 0.5
    expect(moves[1]!.effect10y).toBeGreaterThanOrEqual(moves[2]!.effect10y);
  });

  it('done moves never come back; the next candidate of that kind takes their place', () => {
    const done = rankMoves({ ...p, doneMoveIds: ['cutCategory:eatingOut', 'payCardFirst:card-b'] }, opts);
    expect(ids(done)).toEqual(['cancelSubscriptions', 'cutCategory:other', 'payCardFirst:card-a']);

    const cancelled = rankMoves({ ...p, doneMoveIds: ['cancelSubscriptions'] }, opts);
    expect(ids(cancelled)).not.toContain('cancelSubscriptions');
    expect(ids(cancelled)).toContain('cutCategory:eatingOut');

    const committedAndDone = rankMoves({ ...p, committedMoveId: 'cancelSubscriptions', doneMoveIds: ['cancelSubscriptions'] }, opts);
    expect(ids(committedAndDone)).not.toContain('cancelSubscriptions');
  });

  it('ignores a committed id that is unknown or no longer applies', () => {
    expect(rankMoves({ ...p, committedMoveId: 'payCardFirst:gone' }, opts)).toEqual(rankMoves(p, opts));
    expect(rankMoves({ ...p, committedMoveId: 'hsa' }, opts)).toEqual(rankMoves(p, opts));
  });

  it('is pure and deterministic', () => {
    const frozen = deepFreeze(clone(p));
    const before = clone(frozen);
    const a = rankMoves(frozen, opts);
    expect(rankMoves(frozen, opts)).toEqual(a);
    expect(frozen).toEqual(before);
    expect(ids(rankMoves(deepFreeze(cloneProfileDemo())))).toEqual(ids(rankMoves(profileDemo)));
  });
});

describe('rankMoves: demo profile, default rates', () => {
  it('returns level 1 moves only, in today’s dollars, with the spec formula', () => {
    const moves = rankMoves(profileDemo);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(MOVES_SHOWN);
    expect(moves.every((x) => x.level === 1 && MOVE_LEVELS[x.kind] === 1)).toBe(true);
    expect(ids(moves)).toContain('payCardFirst:card-1'); // the only card (24.36% APR)
    for (const move of moves) expect(move.effect10y).toBeCloseTo(specEffect(profileDemo, move), 6);
  });

  it('uses the given rates (area inflation)', () => {
    const rates = { inflationAnnual: inflationAnnualOf(areaByZip('75206')) };
    for (const move of rankMoves(profileDemo, { rates })) {
      expect(move.effect10y).toBeCloseTo(specEffect(profileDemo, move, rates), 6);
    }
  });

  it('still generates only level 1 moves once level 2 is unlocked (level 2 stays mock)', () => {
    const p = { ...cloneProfileDemo(), doneMoveIds: ['payCardFirst:card-1'] };
    expect(movesLevel(p)).toBe(2);
    expect(rankMoves(p).every((x) => x.level === 1)).toBe(true);
    expect(ids(rankMoves(p))).not.toContain('payCardFirst:card-1');
  });
});

describe('moveCandidates and rankCandidates (the split behind rankMoves)', () => {
  const p = profile({ debts: [card('card-a', 0.18, 3000, 100), card('card-b', 0.29, 2000, 80)] }, { subscriptions: 200 });
  const opts = { rates: ZERO_RATES, subscriptionsDetected: true };
  /** The forecast difference in today's dollars: what rankMoves measures. */
  const rulesEffect = (profileOf: Profile, rates?: Partial<ForecastRates>) => (c: MoveCandidate): Money => {
    const o = { todaysDollars: true, rates };
    return forecast(applyPatch(profileOf, c.patch), 10, o).in10y.mid - forecast(profileOf, 10, o).in10y.mid;
  };
  /** An effect by id, so a test says which move gets which effect. */
  const effects = (byId: Record<string, Money>) => (c: MoveCandidate): Money => byId[c.id] ?? Number.NaN;

  it('rankCandidates(p, moveCandidates(p, o), rulesEffect) equals rankMoves(p, o) for the demo profile', () => {
    expect(rankCandidates(profileDemo, moveCandidates(profileDemo), rulesEffect(profileDemo)))
      .toEqual(rankMoves(profileDemo));

    const rates = { inflationAnnual: inflationAnnualOf(areaByZip('75206')) };
    expect(rankCandidates(profileDemo, moveCandidates(profileDemo, { rates }), rulesEffect(profileDemo, rates)))
      .toEqual(rankMoves(profileDemo, { rates }));
  });

  it('equals rankMoves on the committed, done and statement variants too', () => {
    for (const variant of [
      p,
      { ...p, committedMoveId: 'payCardFirst:card-a' },
      { ...p, committedMoveId: 'cutCategory:other' },
      { ...p, doneMoveIds: ['cutCategory:eatingOut', 'payCardFirst:card-b'] },
    ]) {
      expect(rankCandidates(variant, moveCandidates(variant, opts), rulesEffect(variant, ZERO_RATES)))
        .toEqual(rankMoves(variant, opts));
    }
  });

  it('moveCandidates returns the picked moves without an effect', () => {
    const candidates = moveCandidates(p, opts);
    expect(candidates.map((c) => c.id)).toEqual(['payCardFirst:card-b', 'cutCategory:eatingOut', 'cancelSubscriptions']);
    for (const c of candidates) expect(c).not.toHaveProperty('effect10y');
    expect(candidates[0]).toEqual({
      // surplus = 5000 − 2900 − 100 − 80 = 1920 → × 0.5 = 960
      id: 'payCardFirst:card-b', kind: 'payCardFirst', level: 1, patch: { debts: [{ id: 'card-b', extraPayment: 960 }] },
    });
  });

  it('moveCandidates adds the committed move of a kind that is not the first pick, and leaves done moves out', () => {
    const committed = moveCandidates({ ...p, committedMoveId: 'cutCategory:other' }, opts).map((c) => c.id);
    expect(committed).toEqual(['payCardFirst:card-b', 'cutCategory:eatingOut', 'cutCategory:other', 'cancelSubscriptions']);
    const done = moveCandidates({ ...p, doneMoveIds: ['cutCategory:eatingOut', 'payCardFirst:card-b'] }, opts).map((c) => c.id);
    expect(done).toEqual(['payCardFirst:card-a', 'cutCategory:other', 'cancelSubscriptions']);
  });

  it('moveCandidates is empty when nothing applies, and does not mutate a frozen profile', () => {
    expect(moveCandidates(profile({}, { eatingOut: 0, subscriptions: 0, other: 0 }), { rates: ZERO_RATES })).toEqual([]);
    expect(() => moveCandidates(deepFreeze(clone(p)), opts)).not.toThrow();
  });

  it('a custom effectOf orders the candidates by its values and sets effect10y', () => {
    const byId = { 'payCardFirst:card-b': 30_000, 'cutCategory:eatingOut': 20_000, cancelSubscriptions: 10_000 };
    const ranked = rankCandidates(p, moveCandidates(p, opts), effects(byId));
    expect(ids(ranked)).toEqual(['payCardFirst:card-b', 'cutCategory:eatingOut', 'cancelSubscriptions']);
    expect(ranked.map((x) => x.effect10y)).toEqual([30_000, 20_000, 10_000]);

    const reversed = rankCandidates(p, moveCandidates(p, opts), effects({
      'payCardFirst:card-b': 1_000, 'cutCategory:eatingOut': 2_000, cancelSubscriptions: 3_000,
    }));
    expect(ids(reversed)).toEqual(['cancelSubscriptions', 'cutCategory:eatingOut', 'payCardFirst:card-b']);
  });

  it('keeps each candidate’s own fields and does not call effectOf more than once per candidate', () => {
    const candidates = moveCandidates(p, opts);
    const calls: string[] = [];
    const ranked = rankCandidates(p, candidates, (c) => { calls.push(c.id); return 5_000; });
    expect(calls.sort()).toEqual(candidates.map((c) => c.id).sort());
    for (const move of ranked) {
      const { effect10y: _effect, ...candidate } = move;
      expect(candidate).toEqual(candidates.find((c) => c.id === move.id));
    }
  });

  it('breaks equal effects by kind order, then id', () => {
    const ranked = rankCandidates(p, moveCandidates(p, opts), () => 5_000);
    expect(ids(ranked)).toEqual(['payCardFirst:card-b', 'cutCategory:eatingOut', 'cancelSubscriptions']);
  });

  it('drops effects below $1, zero, negative and non-finite ones', () => {
    const ranked = rankCandidates(p, moveCandidates(p, opts), effects({
      'payCardFirst:card-b': 0.99, 'cutCategory:eatingOut': -500, cancelSubscriptions: 1,
    }));
    expect(ids(ranked)).toEqual(['cancelSubscriptions']);
    expect(rankCandidates(p, moveCandidates(p, opts), () => Number.NaN)).toEqual([]);
    expect(rankCandidates(p, moveCandidates(p, opts), () => 0)).toEqual([]);
  });

  it('an empty candidate list gives no moves and never asks for an effect', () => {
    expect(rankCandidates(p, [], () => { throw new Error('effectOf must not run'); })).toEqual([]);
  });

  it(`returns at most ${MOVES_SHOWN}`, () => {
    const candidates = moveCandidates({ ...p, committedMoveId: 'cutCategory:other' }, opts);
    expect(candidates).toHaveLength(4);
    const ranked = rankCandidates(p, candidates, effects({
      'payCardFirst:card-b': 4_000, 'cutCategory:eatingOut': 3_000, 'cutCategory:other': 2_000, cancelSubscriptions: 1_000,
    }));
    expect(ids(ranked)).toEqual(['payCardFirst:card-b', 'cutCategory:eatingOut', 'cutCategory:other']);
  });

  it('the committed move takes the third slot when it ranks below the top 3 (still sorted)', () => {
    const withCommitted = { ...p, committedMoveId: 'cutCategory:other' };
    const ranked = rankCandidates(withCommitted, moveCandidates(withCommitted, opts), effects({
      cancelSubscriptions: 40_000, 'cutCategory:eatingOut': 30_000, 'payCardFirst:card-b': 20_000, 'cutCategory:other': 5_000,
    }));
    expect(ids(ranked)).toEqual(['cancelSubscriptions', 'cutCategory:eatingOut', 'cutCategory:other']);
    expect(ranked[2]!.effect10y).toBe(5_000);
  });

  it('a committed move whose effect is dropped is not returned', () => {
    const withCommitted = { ...p, committedMoveId: 'cutCategory:other' };
    const ranked = rankCandidates(withCommitted, moveCandidates(withCommitted, opts), effects({
      cancelSubscriptions: 40_000, 'cutCategory:eatingOut': 30_000, 'payCardFirst:card-b': 20_000, 'cutCategory:other': 0.5,
    }));
    expect(ids(ranked)).toEqual(['cancelSubscriptions', 'cutCategory:eatingOut', 'payCardFirst:card-b']);
  });
});

describe('rankMoves: forecast cost', () => {
  const calls = () => vi.mocked(forecast).mock.calls.length;

  it('a profile with no candidates runs no forecast', () => {
    const none = profile({}, { eatingOut: 0, subscriptions: 0, other: 0 });
    expect(moveCandidates(none, { rates: ZERO_RATES })).toEqual([]);
    vi.mocked(forecast).mockClear();
    expect(rankMoves(none, { rates: ZERO_RATES })).toEqual([]);
    expect(calls()).toBe(0);
  });

  it('a card with no surplus (pay 2,100 = rent 2,000 + minimum 100) and nothing to cut runs no forecast either', () => {
    const tight = profile({ takeHomePay: m(2100), debts: [card('c', 0.25, 3000, 100)] }, { eatingOut: 0, subscriptions: 0, other: 0 });
    vi.mocked(forecast).mockClear();
    expect(rankMoves(tight, { rates: ZERO_RATES })).toEqual([]);
    expect(calls()).toBe(0);
  });

  it('with candidates it runs the base forecast once plus one per candidate', () => {
    const p = profile({ debts: [card('card-a', 0.18, 3000, 100)] });
    const candidates = moveCandidates(p, { rates: ZERO_RATES });
    expect(candidates.length).toBeGreaterThan(1);
    vi.mocked(forecast).mockClear();
    rankMoves(p, { rates: ZERO_RATES });
    expect(calls()).toBe(1 + candidates.length);
  });
});

describe('unlock rules', () => {
  const base = { doneMoveIds: [] as string[] };

  it('level 1 is always open; 2 opens once a level 1 move is done or committed; 3 has no rule yet', () => {
    expect(movesLevel(base)).toBe(1);
    expect(isLevelUnlocked(base, 1)).toBe(true);
    expect(isLevelUnlocked(base, 2)).toBe(false);

    for (const p of [
      { doneMoveIds: ['cutCategory:eatingOut'] },
      { doneMoveIds: ['cancelSubscriptions'] },
      { doneMoveIds: [], committedMoveId: 'payCardFirst:card-1' },
    ]) {
      expect(movesLevel(p)).toBe(2);
      expect(isLevelUnlocked(p, 2)).toBe(true);
      expect(isLevelUnlocked(p, 3)).toBe(false);
    }
  });

  it('level 2 moves or unknown ids do not unlock level 2', () => {
    expect(movesLevel({ doneMoveIds: ['hsa', 'refinance:auto-1', 'nonsense'] })).toBe(1);
    expect(movesLevel({ doneMoveIds: [], committedMoveId: 'retirementMatch' })).toBe(1);
  });

  it('moveKindOf reads the kind from an id', () => {
    expect(moveKindOf('payCardFirst:card-1')).toBe('payCardFirst');
    expect(moveKindOf('cutCategory:other')).toBe('cutCategory');
    expect(moveKindOf('cancelSubscriptions')).toBe('cancelSubscriptions');
    expect(moveKindOf('payCard')).toBeUndefined();
    expect(moveKindOf('')).toBeUndefined();
  });
});
