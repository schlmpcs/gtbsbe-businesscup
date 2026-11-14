import { OverpayingResultSchema } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { rangeBar, toResultVM } from './rows';
import { onlyLines, sampleOverpayingResult } from './testUtils';

describe('the hand-built sample result', () => {
  it('is a valid OverpayingResult, so the tests below stand on the contract', () => {
    expect(OverpayingResultSchema.safeParse(sampleOverpayingResult()).success).toBe(true);
  });
});

describe('rangeBar', () => {
  it('puts the range and your marker on one padded axis', () => {
    // typical 1580–1940 (mid 1760), yours 2150. Data span 1580..2150 = 570, padding 30% = 171,
    // axis 1409..2321 (912 wide): low 171/912, mid 351/912, high 531/912, yours 741/912.
    const bar = rangeBar(2150, { low: 1580, mid: 1760, high: 1940 });
    expect(bar.min).toBeCloseTo(1409, 9);
    expect(bar.max).toBeCloseTo(2321, 9);
    expect(bar.low).toBeCloseTo(0.1875, 9);
    expect(bar.mid).toBeCloseTo(351 / 912, 9);
    expect(bar.high).toBeCloseTo(531 / 912, 9);
    expect(bar.yours).toBeCloseTo(0.8125, 9);
  });

  it('works when yours is below the range', () => {
    // typical 800–1200 (mid 1000), yours 500. Span 500..1200 = 700, padding 210, axis 290..1410 (1120).
    const bar = rangeBar(500, { low: 800, mid: 1000, high: 1200 });
    expect(bar.min).toBeCloseTo(290, 9);
    expect(bar.max).toBeCloseTo(1410, 9);
    expect(bar.low).toBeCloseTo(510 / 1120, 9);
    expect(bar.high).toBeCloseTo(910 / 1120, 9);
    expect(bar.yours).toBeCloseTo(210 / 1120, 9);
  });

  it('never starts the axis below zero', () => {
    // typical 10–190 (mid 100), yours 100. Span 180, padding 54: 10 − 54 < 0, so the axis is 0..244.
    const bar = rangeBar(100, { low: 10, mid: 100, high: 190 });
    expect(bar.min).toBe(0);
    expect(bar.max).toBeCloseTo(244, 9);
    expect(bar.low).toBeCloseTo(10 / 244, 9);
    expect(bar.high).toBeCloseTo(190 / 244, 9);
    expect(bar.yours).toBeCloseTo(100 / 244, 9);
  });

  it('centres everything when the range has no width', () => {
    const bar = rangeBar(500, { low: 500, mid: 500, high: 500 });
    expect([bar.low, bar.mid, bar.high, bar.yours]).toEqual([0.5, 0.5, 0.5, 0.5]);
  });
});

describe('toResultVM', () => {
  it('turns the engine result into rows and a summary (own profile used)', () => {
    const vm = toResultVM(sampleOverpayingResult(), { profileUsed: true, kidCount: 1 });
    expect(vm.rows.map((r) => [r.line, r.position])).toEqual([
      ['rent', 'above'],
      ['carInsurance', 'below'],
      ['groceries', 'inRange'],
      ['childcare', 'above'],
    ]);
    expect(vm.rows[0]).toMatchObject({ yours: 3000, gapPerMonth: 324, gapPerYear: 3888, effect10y: 40_000 });
    expect(vm.rows[0]!.typical).toEqual({ low: 1784, mid: 2230, high: 2676 });
    expect(vm.rows[3]).toMatchObject({ gapPerYear: 5894.352, effect10y: 9000 });
    // 2 lines above; 3888 + 5894.352 = 9782.352 a year; 40 000 + 9 000 = 49 000 over 10 years.
    expect(vm.summary.compared).toBe(4);
    expect(vm.summary.above).toBe(2);
    expect(vm.summary.gapPerYear).toBeCloseTo(9782.352, 6);
    expect(vm.summary.effect10y).toBe(49_000);
    expect(vm.summary.effectStatus).toBe('total'); // both lines above have an effect, so the total is of both
    expect(vm.effectAvailable).toBe(true);
  });

  it('says what the 10-year effect is for: the monthly difference between yours and the middle of the range', () => {
    const vm = toResultVM(sampleOverpayingResult(), { profileUsed: true, kidCount: 1 });
    // The gap is yours minus the TOP of the range (324); the effect is for the MIDDLE: 3000 − 2230 = 770 a month.
    expect(vm.rows[0]!.gapPerMonth).toBe(324);
    expect(vm.rows[0]!.toMiddlePerMonth).toBe(770);
    // Childcare: 1500 − 840.67 = 659.33 a month (the gap is 491.196).
    expect(vm.rows[3]!.gapPerMonth).toBeCloseTo(491.196, 6);
    expect(vm.rows[3]!.toMiddlePerMonth).toBeCloseTo(659.33, 6);
    // Not above the range: nothing to say.
    expect(vm.rows[1]!.toMiddlePerMonth).toBeNull();
    expect(vm.rows[2]!.toMiddlePerMonth).toBeNull();
  });

  it('shows no 10-year effect for lines that are not above the range', () => {
    const vm = toResultVM(sampleOverpayingResult(), { profileUsed: true, kidCount: 1 });
    expect(vm.rows[1]!.effect10y).toBeNull(); // below
    expect(vm.rows[2]!.effect10y).toBeNull(); // in range
  });

  it('shows no 10-year effect without a profile of the person\'s own: the engine would say 0, not "unknown"', () => {
    const result = sampleOverpayingResult();
    for (const l of result.lines) l.effect10y = 0; // what the engine returns without a profile
    const vm = toResultVM(result, { profileUsed: false, kidCount: 1 });
    expect(vm.rows.map((r) => r.effect10y)).toEqual([null, null, null, null]);
    expect(vm.summary.effect10y).toBeNull();
    expect(vm.summary.effectStatus).toBe('needsProfile');
    expect(vm.effectAvailable).toBe(false);
    expect(vm.summary.gapPerYear).toBeCloseTo(9782.352, 6); // the gap does not need a profile
  });

  it('does not show an effect that arrives without a profile of the person\'s own, whatever the engine said', () => {
    const vm = toResultVM(sampleOverpayingResult(), { profileUsed: false, kidCount: 1 }); // effects 40 000 and 9 000 kept
    expect(vm.rows.map((r) => r.effect10y)).toEqual([null, null, null, null]);
    expect(vm.summary.effect10y).toBeNull();
  });

  it('treats an effect of 0 on a line above the range as "could not be worked out"', () => {
    // The engine returns 0 when the profile's category is smaller than the change asked of it.
    const result = sampleOverpayingResult();
    result.lines[3]!.effect10y = 0;
    const vm = toResultVM(result, { profileUsed: true, kidCount: 1 });
    expect(vm.rows[3]!.effect10y).toBeNull();
    expect(vm.rows[0]!.effect10y).toBe(40_000); // the line that has one keeps it
  });

  it('never adds up a partial total: with an effect for only one of two lines above the range, there is no total', () => {
    // (This replaces a test that locked in the old behaviour: summary.effect10y was 40 000, the one line's effect, under "closing each gap".)
    const result = sampleOverpayingResult();
    result.lines[3]!.effect10y = 0; // childcare above the range, but the profile cannot take it
    const vm = toResultVM(result, { profileUsed: true, kidCount: 1 });
    expect(vm.summary.above).toBe(2);
    expect(vm.summary.effect10y).toBeNull();
    expect(vm.summary.effectStatus).toBe('partial');
  });

  it('says so when no line above the range has an effect, or when no line is above it', () => {
    const none = sampleOverpayingResult();
    none.lines[0]!.effect10y = 0;
    none.lines[3]!.effect10y = 0;
    const a = toResultVM(none, { profileUsed: true, kidCount: 1 });
    expect([a.summary.effect10y, a.summary.effectStatus]).toEqual([null, 'none']);

    const inRange = onlyLines(sampleOverpayingResult(), ['carInsurance', 'groceries']); // below and in range
    const b = toResultVM(inRange, { profileUsed: true, kidCount: 1 });
    expect([b.summary.above, b.summary.effect10y, b.summary.effectStatus]).toEqual([0, null, 'notApplicable']);
  });

  it('keeps the source and estimate flag with each row', () => {
    const vm = toResultVM(sampleOverpayingResult({ isEstimate: false }), { profileUsed: false, kidCount: 1 });
    expect(vm.rows.every((r) => r.isEstimate === false)).toBe(true);
    expect(vm.rows[0]!.source.name).toMatch(/HUD/);
    expect(vm.rows[0]!.source.year).toBe(2027);
  });

  it('names why a line was skipped: blank, no data, or no children for childcare', () => {
    const base = onlyLines(sampleOverpayingResult(), ['rent']);
    base.skipped = [
      { line: 'carInsurance', reason: 'notEntered' },
      { line: 'groceries', reason: 'noData' },
      { line: 'childcare', reason: 'noData' },
    ];
    expect(toResultVM(base, { profileUsed: false, kidCount: 0 }).skipped).toEqual([
      { line: 'carInsurance', reason: 'notEntered' },
      { line: 'groceries', reason: 'noData' },
      { line: 'childcare', reason: 'noKids' }, // childcare entered, but no children to price it for
    ]);
    // With a child, the same engine answer means the area has no childcare data.
    expect(toResultVM(base, { profileUsed: false, kidCount: 1 }).skipped.at(-1)).toEqual({ line: 'childcare', reason: 'noData' });
  });

  it('a result with no comparable line is still a result', () => {
    const empty = { ...sampleOverpayingResult(), lines: [], skipped: [{ line: 'childcare' as const, reason: 'noData' as const }] };
    const vm = toResultVM(empty, { profileUsed: true, kidCount: 1 });
    expect(vm.rows).toEqual([]);
    expect(vm.summary).toEqual({ compared: 0, above: 0, gapPerYear: 0, effect10y: null, effectStatus: 'notApplicable' });
  });
});
