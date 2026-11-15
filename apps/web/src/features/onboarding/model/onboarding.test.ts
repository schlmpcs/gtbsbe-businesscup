// The onboarding story's model: the practice duel (engine pairs and scores, the guess error), the
// month reveal, the landing's decision and the stored record.
import { costOfLife, scoreDuelPick } from '@lifeguessr/engine';
import type { Profile } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { profileDemo } from '@/fixtures';
import { cardsSample } from '@/fixtures/cards';
import { monthlyCost } from '@/features/ladder/model/ownLife';
import { areaForZip } from '@/lib/areas';
import { monthReveal } from './monthReveal';
import { chapterHref, parseRecord } from './onboardingStore';
import { guessError, practiceCard, practicePairs, practiceSummary, scorePractice, PRACTICE_ROUNDS } from './practiceDuel';
import { landingMode } from './useLanding';

describe('practice duel', () => {
  const pairs = practicePairs();

  it('plays three fixed pairs of sample lives, the same for everyone', () => {
    expect(pairs).toHaveLength(PRACTICE_ROUNDS);
    expect(practicePairs().map((p) => [p.cards.A.id, p.cards.B.id])).toEqual(pairs.map((p) => [p.cards.A.id, p.cards.B.id]));
    for (const p of pairs) expect(p.cards.A.id).not.toBe(p.cards.B.id);
    const ids = new Set(cardsSample.map((c) => c.id));
    for (const p of pairs) expect(ids.has(p.cards.A.id) && ids.has(p.cards.B.id)).toBe(true);
  });

  it('scores with the engine: totals are costOfLife, right = the costlier life', () => {
    const p = pairs[0]!;
    const totals = { A: costOfLife(p.cards.A, areaForZip(p.cards.A.zip)!).total.mid, B: costOfLife(p.cards.B, areaForZip(p.cards.B.zip)!).total.mid };
    const costlier = totals.A > totals.B ? 'A' : 'B';
    const r = scorePractice(p, costlier, 3_000);
    expect(r.correct).toBe(true);
    expect(r.actual).toBe(totals[costlier]);
    expect(r.error).toBeCloseTo(Math.abs(3_000 - totals[costlier]) / totals[costlier], 10);
    expect(r.gap).toBeCloseTo(Math.abs(totals.A - totals.B), 6);
    expect(r.decidedBy).toBe(scoreDuelPick(p.costs, costlier, 0).decidedBy.category);
    expect(scorePractice(p, costlier === 'A' ? 'B' : 'A', 3_000).correct).toBe(false);
  });

  it('measures a guess as |guess − actual| / actual', () => {
    expect(guessError(3_000, 4_000)).toBeCloseTo(0.25, 10);
    expect(guessError(5_000, 4_000)).toBeCloseTo(0.25, 10);
    expect(guessError(4_000, 4_000)).toBe(0);
    expect(guessError(4_000, 0)).toBe(1);
  });

  it('averages the rounds and says whether they were mostly low', () => {
    const r = pairs.map((p, i) => scorePractice(p, 'A', [1_000, 2_000, 30_000][i]!));
    const s = practiceSummary(r);
    expect(s.averageError).toBeCloseTo((r[0]!.error + r[1]!.error + r[2]!.error) / 3, 10);
    expect(s.rounds).toHaveLength(3);
    expect(s.mostlyLow).toBe(true);
    expect(s.right).toBe(r.filter((x) => x.correct).length);
  });

  it('shows no total before the reveal, and bars no wider than the larger total after it', () => {
    const p = pairs[1]!;
    const hidden = practiceCard(p, 'A', { revealed: false, picked: true });
    expect(hidden.total).toBeNull();
    expect(hidden.bars).toEqual([]);
    expect(hidden.picked).toBe(true);
    const a = practiceCard(p, 'A', { revealed: true, picked: false });
    const b = practiceCard(p, 'B', { revealed: true, picked: false });
    expect(a.costlier !== b.costlier).toBe(true);
    expect(Math.max(a.totalShare!, b.totalShare!)).toBe(1);
    for (const bar of [...a.bars, ...b.bars]) expect(bar.share).toBeLessThanOrEqual(1);
  });
});

describe('month reveal', () => {
  const profile = profileDemo as Profile;

  it('compares the guess with the month (spending + minimum payments)', () => {
    const actual = monthlyCost(profile);
    const r = monthReveal(actual - 500, profile, [], 'card-x');
    expect(r.actual).toBe(actual);
    expect(r.difference).toBeCloseTo(500, 6);
    expect(r.differenceShare).toBeCloseTo(500 / (actual - 500), 10);
    expect(r.direction).toBe('more');
    expect(r.actualShare).toBe(1);
    expect(r.guessShare).toBeCloseTo((actual - 500) / actual, 10);
    expect(r.categories.reduce((s, c) => s + c.amount, 0)).toBeCloseTo(actual, 6);
    expect(r.categories.map((c) => c.amount)).toEqual([...r.categories.map((c) => c.amount)].sort((x, y) => y - x));
  });

  it('says where the month came from, and shows no gap without a guess', () => {
    const none = monthReveal(null, profile, [], null); // the demo family's month is not the person's
    expect(none.difference).toBeNull();
    expect(none.direction).toBeNull();
    expect(none.from).toBe('estimate');
    expect(none.isEstimate).toBe(true);
    const stmt = monthReveal(4_000, profile, [{ month: '2026-10', totals: {}, oneOffs: [] } as never], 'card-x');
    expect(stmt.from).toBe('statement');
    expect(stmt.isEstimate).toBe(false);
  });
});

describe('landing and the stored record', () => {
  it('sends finished stories and old ladder profiles to the dashboard; resumes a story in progress', () => {
    expect(landingMode(null, 'demo')).toEqual({ mode: 'fresh', resumeChapter: null });
    expect(landingMode(null, 'closestLife').mode).toBe('redirect');
    expect(landingMode({ chapter: 4, done: true, practiceError: null }, 'demo').mode).toBe('redirect');
    expect(landingMode({ chapter: 3, done: false, practiceError: 0.2 }, 'user')).toEqual({ mode: 'continue', resumeChapter: 3 });
    expect(landingMode({ chapter: 1, done: false, practiceError: null }, 'demo').mode).toBe('fresh');
  });

  it('reads only well-formed records', () => {
    expect(parseRecord(null)).toBeNull();
    expect(parseRecord('nope')).toBeNull();
    expect(parseRecord('{"chapter":7,"done":false}')).toBeNull();
    expect(parseRecord('{"chapter":2,"done":false,"practiceError":-1}')).toEqual({ chapter: 2, done: false, practiceError: null });
    expect(parseRecord('{"chapter":4,"done":true,"practiceError":0.3}')).toEqual({ chapter: 4, done: true, practiceError: 0.3 });
  });

  it('puts chapters 2–4 in the URL', () => {
    expect(chapterHref(1)).toBe('/start');
    expect(chapterHref(4)).toBe('/start?ch=4');
  });
});
