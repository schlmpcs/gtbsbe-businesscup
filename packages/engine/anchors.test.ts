// Anchor helpers for the AI forecast (Y15): structural checks, interpolation to a Forecast, the
// today's-dollars conversion and the sanity envelope against the rules engine. Fixtures only.
import { describe, expect, it } from 'vitest';
import type { Forecast, ForecastPoint, Profile, YearAnchor } from '@lifeguessr/types';
import { areaByZip, cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import { aiForecastSanity, assumptions } from './assumptions';
import {
  anchorIssues, anchorsToForecast, deflateForecast, forecastSanityIssues, scenarioEffectIssues,
} from './anchors';
import { applyPatch, forecast } from './forecast';
import { inflationAnnualOf } from './simulate';

const TODAY = 10_000;

/** Ten valid anchors: mid +$5,000 a year from $10,000, band ±$1,000 × year below and +$2,000 × year above. */
function validAnchors(): YearAnchor[] {
  return Array.from({ length: 10 }, (_, i) => {
    const year = i + 1;
    const mid = TODAY + 5_000 * year;
    return { year, low: mid - 1_000 * year, mid, high: mid + 2_000 * year };
  });
}

describe('aiForecastSanity', () => {
  it('holds the guard values, is marked as an assumption, and stays out of the user-facing list', () => {
    expect(aiForecastSanity.value).toEqual({
      relative: 0.25, floorMonths: 12, bandMaxRatio: 3, effectRatioMin: 1 / 3, effectRatioMax: 3, effectFloor: 1_000,
    });
    expect(aiForecastSanity.assumption).toBe(true);
    expect(Object.keys(assumptions)).not.toContain('aiForecastSanity');
  });
});

describe('anchorIssues', () => {
  it('returns [] for ten valid anchors, years 1..10', () => {
    expect(anchorIssues(validAnchors())).toEqual([]);
  });

  it('accepts a zero-width band (low = mid = high) and negative net worth', () => {
    const flat = validAnchors().map((a, i) => ({ year: a.year, low: -1_000 * (i + 1), mid: -1_000 * (i + 1), high: -1_000 * (i + 1) }));
    expect(anchorIssues(flat)).toEqual([]);
  });

  it('rejects the wrong number of anchors', () => {
    expect(anchorIssues(validAnchors().slice(0, 9)).length).toBeGreaterThan(0);
    expect(anchorIssues([...validAnchors(), { year: 11, low: 0, mid: 0, high: 0 }]).length).toBeGreaterThan(0);
    expect(anchorIssues([]).length).toBeGreaterThan(0);
  });

  it('rejects years out of order, repeated or outside 1..10', () => {
    const swapped = validAnchors();
    swapped[1] = { ...swapped[1]!, year: 3 };
    swapped[2] = { ...swapped[2]!, year: 2 };
    expect(anchorIssues(swapped).length).toBeGreaterThan(0);

    const repeated = validAnchors();
    repeated[4] = { ...repeated[4]!, year: 4 };
    expect(anchorIssues(repeated).length).toBeGreaterThan(0);

    const zeroBased = validAnchors().map((a) => ({ ...a, year: a.year - 1 }));
    expect(anchorIssues(zeroBased).length).toBeGreaterThan(0);
  });

  it('rejects NaN and Infinity in any field, naming the year', () => {
    for (const field of ['low', 'mid', 'high'] as const) {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
        const a = validAnchors();
        a[6] = { ...a[6]!, [field]: bad };
        const issues = anchorIssues(a);
        expect(issues.length).toBeGreaterThan(0);
        expect(issues.join(' ')).toContain('year 7');
      }
    }
  });

  it('rejects low > mid and mid > high, naming the year', () => {
    const lowAboveMid = validAnchors();
    lowAboveMid[2] = { ...lowAboveMid[2]!, low: lowAboveMid[2]!.mid + 1 };
    expect(anchorIssues(lowAboveMid).join(' ')).toContain('year 3');

    const midAboveHigh = validAnchors();
    midAboveHigh[8] = { ...midAboveHigh[8]!, high: midAboveHigh[8]!.mid - 1 };
    expect(anchorIssues(midAboveHigh).join(' ')).toContain('year 9');
  });

  it('reports every problem, not only the first', () => {
    const a = validAnchors();
    a[0] = { ...a[0]!, low: a[0]!.mid + 1 };
    a[5] = { ...a[5]!, mid: Number.NaN };
    expect(anchorIssues(a).length).toBeGreaterThanOrEqual(2);
  });
});

describe('anchorsToForecast', () => {
  const f = anchorsToForecast(validAnchors(), TODAY);

  it('has 121 points, months 0..120, nominal dollars', () => {
    expect(f.points).toHaveLength(121);
    expect(f.points.map((p) => p.month)).toEqual([...Array(121).keys()]);
    expect(f.todaysDollars).toBe(false);
  });

  it('month 0 is today exactly, with no band', () => {
    expect(f.points[0]).toEqual({ month: 0, mid: TODAY, low: TODAY, high: TODAY });
  });

  it('every year-end point is its anchor exactly', () => {
    for (const a of validAnchors()) {
      expect(f.points[12 * a.year]).toEqual({ month: 12 * a.year, low: a.low, mid: a.mid, high: a.high });
    }
    expect(f.points[12]).toEqual({ month: 12, low: 14_000, mid: 15_000, high: 17_000 });
  });

  it('interpolates linearly inside a year', () => {
    expect(f.points[6]!.mid).toBeCloseTo((f.points[0]!.mid + f.points[12]!.mid) / 2, 9);
    expect(f.points[6]!.low).toBeCloseTo((f.points[0]!.low + f.points[12]!.low) / 2, 9);
    expect(f.points[6]!.high).toBeCloseTo((f.points[0]!.high + f.points[12]!.high) / 2, 9);
    const a = f.points[24]!;
    const b = f.points[36]!;
    expect(f.points[27]!.mid).toBeCloseTo(a.mid + (b.mid - a.mid) * (3 / 12), 9);
  });

  it('in10y is the month-120 point', () => {
    expect(f.in10y).toBe(f.points[120]);
    expect(f.in10y.mid).toBe(60_000);
  });

  it('low ≤ mid ≤ high at every point', () => {
    for (const p of f.points) {
      expect(p.low).toBeLessThanOrEqual(p.mid);
      expect(p.mid).toBeLessThanOrEqual(p.high);
    }
  });

  it('keeps low ≤ mid ≤ high when interpolation rounds the wrong way (edges a few ulps from mid)', () => {
    // Found by search: a + (b − a) × t puts `low` above `mid` at month 34 for these two years.
    const a = 172_370.21438777447;
    const b = -174_469.00056675076;
    const ulps = (x: number, k: number) => Math.abs(x) * 2 ** -52 * k;
    const anchors = validAnchors().map((x) => ({ year: x.year, low: x.mid, mid: x.mid, high: x.mid }));
    anchors[1] = { year: 2, low: a - ulps(a, 2), mid: a, high: a + ulps(a, 2) };
    anchors[2] = { year: 3, low: b, mid: b, high: b };
    expect(anchorIssues(anchors)).toEqual([]);
    for (const p of anchorsToForecast(anchors, TODAY).points) {
      expect(p.low).toBeLessThanOrEqual(p.mid);
      expect(p.mid).toBeLessThanOrEqual(p.high);
    }
  });

  it('handles a negative today balance and a decline', () => {
    const down = validAnchors().map((a) => ({ year: a.year, low: -a.year * 3_000 - 500, mid: -a.year * 3_000, high: -a.year * 3_000 + 500 }));
    const g = anchorsToForecast(down, -2_000);
    expect(g.points[0]).toEqual({ month: 0, mid: -2_000, low: -2_000, high: -2_000 });
    expect(g.in10y.mid).toBe(-30_000);
  });

  it('does not mutate its input', () => {
    const input = validAnchors();
    const before = JSON.parse(JSON.stringify(input)) as YearAnchor[];
    anchorsToForecast(Object.freeze(input.map((a) => Object.freeze(a))), TODAY);
    expect(input).toEqual(before);
  });

  it('throws RangeError for invalid anchors or a non-finite today balance', () => {
    expect(() => anchorsToForecast(validAnchors().slice(0, 9), TODAY)).toThrow(RangeError);
    const bad = validAnchors();
    bad[0] = { ...bad[0]!, low: bad[0]!.mid + 1 };
    expect(() => anchorsToForecast(bad, TODAY)).toThrow(RangeError);
    expect(() => anchorsToForecast(validAnchors(), Number.NaN)).toThrow(RangeError);
    expect(() => anchorsToForecast(validAnchors(), Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('deflateForecast', () => {
  const nominal = forecast(profileDemo);

  it('divides point m by (1 + inflation)^(m/12) and marks today’s dollars', () => {
    const real = deflateForecast(nominal, 0.03);
    expect(real.todaysDollars).toBe(true);
    expect(real.points).toHaveLength(nominal.points.length);
    for (const [m, p] of real.points.entries()) {
      const n = nominal.points[m]!;
      const d = 1.03 ** (m / 12);
      expect(p.month).toBe(m);
      expect(p.mid).toBeCloseTo(n.mid / d, 9);
      expect(p.low).toBeCloseTo(n.low / d, 9);
      expect(p.high).toBeCloseTo(n.high / d, 9);
    }
    expect(real.in10y).toEqual(real.points[120]);
  });

  it('in10y is the month-120 point itself, as in forecast() and anchorsToForecast()', () => {
    const real10 = deflateForecast(nominal, 0.03);
    expect(real10.in10y).toBe(real10.points[120]);
    const longer = forecast(profileDemo, 20); // 241 points: in10y is still the month-120 point
    const real = deflateForecast(longer, 0.03);
    expect(real.in10y).toBe(real.points[120]);
    expect(real.in10y.month).toBe(120);
  });

  it('matches forecast(…, { todaysDollars: true }) for the same rate', () => {
    const inflationAnnual = inflationAnnualOf(areaByZip(profileDemo.zip!));
    const direct = forecast(profileDemo, 10, { rates: { inflationAnnual }, todaysDollars: true });
    const viaDeflate = deflateForecast(forecast(profileDemo, 10, { rates: { inflationAnnual } }), inflationAnnual);
    for (const [m, p] of viaDeflate.points.entries()) {
      expect(p.mid).toBeCloseTo(direct.points[m]!.mid, 6);
      expect(p.low).toBeCloseTo(direct.points[m]!.low, 6);
      expect(p.high).toBeCloseTo(direct.points[m]!.high, 6);
    }
  });

  it('keeps low ≤ mid ≤ high, leaves month 0 unchanged and does not mutate the input', () => {
    const frozen = JSON.parse(JSON.stringify(nominal)) as Forecast;
    const real = deflateForecast(nominal, 0.04);
    expect(nominal).toEqual(frozen);
    expect(real.points[0]).toEqual(nominal.points[0]);
    for (const p of real.points) {
      expect(p.low).toBeLessThanOrEqual(p.mid);
      expect(p.mid).toBeLessThanOrEqual(p.high);
    }
  });

  it('throws RangeError when the forecast is already in today’s dollars', () => {
    const real = deflateForecast(nominal, 0.03);
    expect(() => deflateForecast(real, 0.03)).toThrow(RangeError);
  });

  it('throws RangeError for an inflation rate that cannot deflate', () => {
    expect(() => deflateForecast(nominal, Number.NaN)).toThrow(RangeError);
    expect(() => deflateForecast(nominal, -1)).toThrow(RangeError);
  });
});

// ----- sanity envelope ---------------------------------------------------------------------------

const rates = { inflationAnnual: inflationAnnualOf(areaByZip(profileDemo.zip!)) };

/** A copy of `f` with every point rewritten; `in10y` is kept equal to the month-120 point. */
function remap(f: Forecast, fn: (p: ForecastPoint) => Omit<ForecastPoint, 'month'>): Forecast {
  const points = f.points.map((p) => ({ month: p.month, ...fn(p) }));
  return { points, in10y: points[120]!, todaysDollars: f.todaysDollars };
}

/** The demo profile with every estimate flag cleared: a reference forecast with no band. */
function measuredDemo(): Profile {
  const p = cloneProfileDemo();
  p.age.isEstimate = false;
  p.takeHomePay.isEstimate = false;
  p.cash.isEstimate = false;
  p.retirement.isEstimate = false;
  p.retirementShare.isEstimate = false;
  for (const e of Object.values(p.spending)) e.isEstimate = false;
  for (const d of p.debts) d.minPayment.isEstimate = false;
  return p;
}

/** A profile whose net worth ends below zero: debts exceed assets and the pay barely covers spending. */
function underwaterProfile(): Profile {
  const p = cloneProfileDemo();
  p.takeHomePay = { value: 3_600, isEstimate: true };
  p.cash = { value: -1_500, isEstimate: true };
  p.retirement = { value: 2_000, isEstimate: true };
  const card = p.debts.find((d) => d.kind === 'card')!;
  card.balance = 30_000;
  return p;
}

describe('forecastSanityIssues', () => {
  const profile = profileDemo;
  const ref = forecast(profile, 10, { rates });
  const pay = profile.takeHomePay.value;

  it('accepts the reference itself', () => {
    expect(forecastSanityIssues(ref, ref, pay)).toEqual([]);
  });

  it('defaults the envelope to aiForecastSanity and accepts an explicit one', () => {
    expect(forecastSanityIssues(ref, ref, pay, aiForecastSanity.value)).toEqual([]);
    const tripled = remap(ref, (p) => ({ mid: p.mid * 3, low: p.low * 3, high: p.high * 3 }));
    expect(forecastSanityIssues(tripled, ref, pay).length).toBeGreaterThan(0);
    // A loose enough envelope lets the same answer through: the envelope argument is used.
    const loose = { ...aiForecastSanity.value, relative: 5 };
    expect(forecastSanityIssues(tripled, ref, pay, loose)).toEqual([]);
  });

  it('accepts a plausible answer a fifth above the reference, band included', () => {
    const near = remap(ref, (p) => ({ mid: p.mid * 1.2, low: p.low * 1.2, high: p.high * 1.2 }));
    expect(forecastSanityIssues(near, ref, pay)).toEqual([]);
  });

  it('accepts yearly anchors read off the reference (a perfect model)', () => {
    const anchors: YearAnchor[] = Array.from({ length: 10 }, (_, i) => {
      const p = ref.points[12 * (i + 1)]!;
      return { year: i + 1, low: p.low, mid: p.mid, high: p.high };
    });
    expect(anchorIssues(anchors)).toEqual([]);
    expect(forecastSanityIssues(anchorsToForecast(anchors, ref.points[0]!.mid), ref, pay)).toEqual([]);
  });

  it('rejects every mid ×3, naming the year and the bound', () => {
    const tripled = remap(ref, (p) => ({ mid: p.mid * 3, low: p.low * 3, high: p.high * 3 }));
    const issues = forecastSanityIssues(tripled, ref, pay);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.join('\n')).toMatch(/year 10/);
    expect(issues.join('\n')).toMatch(/above/);
    expect(issues.join('\n')).toMatch(/\$/);
  });

  it('rejects every value ÷1000 (a model that answered in thousands)', () => {
    const thousands = remap(ref, (p) => ({ mid: p.mid / 1000, low: p.low / 1000, high: p.high / 1000 }));
    const issues = forecastSanityIssues(thousands, ref, pay);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.join('\n')).toMatch(/below/);
  });

  it('rejects a band 10× wider than the reference band', () => {
    const wide = remap(ref, (p) => ({ mid: p.mid, low: p.mid - (p.mid - p.low) * 10, high: p.mid + (p.high - p.mid) * 10 }));
    const issues = forecastSanityIssues(wide, ref, pay);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.join('\n')).toMatch(/band/);
  });

  it('rejects NaN and Infinity instead of letting a failed comparison pass', () => {
    const nan = remap(ref, (p) => (p.month === 60 ? { mid: Number.NaN, low: Number.NaN, high: Number.NaN } : p));
    expect(forecastSanityIssues(nan, ref, pay).join('\n')).toMatch(/year 5/);
    const inf = remap(ref, (p) => (p.month === 120 ? { mid: p.mid, low: p.low, high: Number.POSITIVE_INFINITY } : p));
    expect(forecastSanityIssues(inf, ref, pay).length).toBeGreaterThan(0);
  });

  it('rejects a candidate with too few points instead of throwing', () => {
    const short: Forecast = { points: ref.points.slice(0, 60), in10y: ref.in10y, todaysDollars: false };
    expect(forecastSanityIssues(short, ref, pay).length).toBeGreaterThan(0);
  });

  it('a negative net worth is judged on its size, not its sign: the reference passes, a ±20% answer passes, a flipped sign fails', () => {
    const under = underwaterProfile();
    const underRef = forecast(under, 10, { rates });
    expect(underRef.in10y.mid).toBeLessThan(0);
    const underPay = under.takeHomePay.value;

    expect(forecastSanityIssues(underRef, underRef, underPay)).toEqual([]);
    const deeper = remap(underRef, (p) => ({ mid: p.mid * 1.2, low: p.low * 1.2, high: p.high * 1.2 }));
    expect(forecastSanityIssues(deeper, underRef, underPay)).toEqual([]);
    const shallower = remap(underRef, (p) => ({ mid: p.mid * 0.8, low: p.low * 0.8, high: p.high * 0.8 }));
    expect(forecastSanityIssues(shallower, underRef, underPay)).toEqual([]);

    const flipped = remap(underRef, (p) => ({ mid: -p.mid * 3, low: -p.high * 3, high: -p.low * 3 }));
    expect(forecastSanityIssues(flipped, underRef, underPay).length).toBeGreaterThan(0);
  });

  describe('a reference with no band (every input measured)', () => {
    const measured = measuredDemo();
    const flatRef = forecast(measured, 10, { rates });
    const tolerance = aiForecastSanity.value.floorMonths * measured.takeHomePay.value;

    it('has a zero band, and accepts itself', () => {
      expect(flatRef.in10y.high - flatRef.in10y.low).toBe(0);
      expect(forecastSanityIssues(flatRef, flatRef, measured.takeHomePay.value)).toEqual([]);
    });

    it('accepts a candidate band no wider than the tolerance', () => {
      const half = (tolerance * 0.9) / 2;
      const banded = remap(flatRef, (p) => ({ mid: p.mid, low: p.mid - half, high: p.mid + half }));
      expect(forecastSanityIssues(banded, flatRef, measured.takeHomePay.value)).toEqual([]);
    });

    it('rejects a candidate band far wider than the tolerance', () => {
      const half = tolerance * 20;
      const banded = remap(flatRef, (p) => ({ mid: p.mid, low: p.mid - half, high: p.mid + half }));
      expect(forecastSanityIssues(banded, flatRef, measured.takeHomePay.value).join('\n')).toMatch(/band/);
    });
  });
});

describe('forecastSanityIssues: programmer errors throw instead of passing every candidate', () => {
  const ref = forecast(profileDemo, 10, { rates });
  const pay = profileDemo.takeHomePay.value;

  it.each([['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY], ['-Infinity', Number.NEGATIVE_INFINITY]])(
    'throws RangeError for a takeHomePay of %s',
    (_label, bad) => {
      expect(() => forecastSanityIssues(ref, ref, bad)).toThrow(RangeError);
    },
  );

  it.each(['low', 'mid', 'high'] as const)('throws RangeError for a non-finite reference %s, even for a perfect candidate', (field) => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const broken = remap(ref, (p) => (p.month === 36 ? { mid: p.mid, low: p.low, high: p.high, [field]: bad } : p));
      expect(() => forecastSanityIssues(broken, broken, pay)).toThrow(RangeError);
      expect(() => forecastSanityIssues(ref, broken, pay)).toThrow(RangeError);
    }
  });

  it('a non-finite value in the candidate is still an issue, not a throw', () => {
    const nan = remap(ref, (p) => (p.month === 36 ? { mid: Number.NaN, low: p.low, high: p.high } : p));
    expect(forecastSanityIssues(nan, ref, pay).join('\n')).toMatch(/year 3/);
  });

  it('throws RangeError when the candidate and the reference are not in the same dollars', () => {
    const real = deflateForecast(ref, 0.03);
    expect(() => forecastSanityIssues(real, ref, pay)).toThrow(RangeError);
    expect(() => forecastSanityIssues(ref, real, pay)).toThrow(RangeError);
  });

  it('accepts two forecasts that are both in today’s dollars', () => {
    const real = deflateForecast(ref, 0.03);
    expect(forecastSanityIssues(real, real, pay)).toEqual([]);
  });
});

describe('forecastSanityIssues: the tolerance at the extremes of net worth', () => {
  /** The same net worth at every month, with a symmetric band of ± `half`. */
  const flat = (mid: number, half = 0): Forecast => {
    const points = Array.from({ length: 121 }, (_, month) => ({ month, mid, low: mid - half, high: mid + half }));
    return { points, in10y: points[120]!, todaysDollars: false };
  };
  const pay = 5_000; // the floor tolerance is 12 × 5,000 = $60,000

  it('near zero the tolerance is a year of pay, so a sensible answer passes and a runaway one fails', () => {
    expect(forecastSanityIssues(flat(40_000), flat(0), pay)).toEqual([]);
    expect(forecastSanityIssues(flat(-40_000), flat(-10), pay)).toEqual([]);
    expect(forecastSanityIssues(flat(300_000), flat(0), pay).length).toBeGreaterThan(0);
    expect(forecastSanityIssues(flat(-300_000), flat(0), pay).length).toBeGreaterThan(0);
  });

  it('far from zero the tolerance is relative to the size, for a negative net worth as for a positive one', () => {
    expect(forecastSanityIssues(flat(600_000), flat(500_000), pay)).toEqual([]);
    expect(forecastSanityIssues(flat(-600_000), flat(-500_000), pay)).toEqual([]);
    // ±25% of |rules mid| (= $125,000 here): just inside passes, just outside does not
    expect(forecastSanityIssues(flat(620_000), flat(500_000), pay)).toEqual([]);
    expect(forecastSanityIssues(flat(630_000), flat(500_000), pay).length).toBeGreaterThan(0);
    expect(forecastSanityIssues(flat(370_000), flat(500_000), pay).length).toBeGreaterThan(0);
    expect(forecastSanityIssues(flat(-1_200_000), flat(-500_000), pay).length).toBeGreaterThan(0);
    expect(forecastSanityIssues(flat(1_200_000), flat(500_000), pay).length).toBeGreaterThan(0);
  });

  it('measures the band against the rules band, with the tolerance as its floor', () => {
    const reference = flat(100_000, 10_000); // band 20,000; tolerance 60,000 → limit max(3 × 20,000, 60,000)
    expect(forecastSanityIssues(flat(100_000, 29_000), reference, pay)).toEqual([]);
    expect(forecastSanityIssues(flat(100_000, 31_000), reference, pay).join('\n')).toMatch(/band/);
  });
});

describe('scenarioEffectIssues', () => {
  /** A forecast whose only meaningful value is the month-120 mid (the helper reads `in10y.mid`). */
  const at120 = (mid: number): Forecast => {
    const points = Array.from({ length: 121 }, (_, month) => ({ month, mid: month === 120 ? mid : 0, low: 0, high: 0 }));
    return { points, in10y: points[120]!, todaysDollars: false };
  };
  const base = 100_000;
  const pair = (effect: number) => ({ base: at120(base), scenario: at120(base + effect) });

  describe('with a rules effect of +$5,000', () => {
    const reference = pair(5_000);

    it.each([
      ['+$5,000 (equal)', 5_000],
      ['+$5,900 (inside the $1,000 floor)', 5_900],
      ['+$4,100 (inside the floor, below)', 4_100],
      ['+$7,500 (ratio 1.5)', 7_500],
      ['+$14,000 (ratio 2.8)', 14_000],
      ['+$1,800 (ratio 0.36)', 1_800],
    ])('accepts an AI effect of %s', (_label, effect) => {
      expect(scenarioEffectIssues(pair(effect), reference)).toEqual([]);
    });

    it.each([
      ['$0 (scenario equal to base)', 0],
      ['−$5,000 (wrong sign)', -5_000],
      ['+$25,000 (5×)', 25_000],
      ['+$16,000 (3.2×)', 16_000],
      ['+$1,000 (a fifth)', 1_000],
      ['+$1,500 (0.3×)', 1_500],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('rejects an AI effect of %s', (_label, effect) => {
      expect(scenarioEffectIssues(pair(effect), reference).length).toBeGreaterThan(0);
    });

    it('says what is wrong for each kind of mistake', () => {
      expect(scenarioEffectIssues(pair(0), reference).join(' ')).toMatch(/base/i);
      expect(scenarioEffectIssues(pair(-5_000), reference).join(' ')).toMatch(/sign|raise/i);
      expect(scenarioEffectIssues(pair(25_000), reference).join(' ')).toMatch(/\$/);
    });
  });

  describe('with a rules effect under $1', () => {
    const reference = pair(0.5);

    it('accepts an AI effect inside the floor', () => {
      expect(scenarioEffectIssues(pair(500), reference)).toEqual([]);
      expect(scenarioEffectIssues(pair(0), reference)).toEqual([]);
      expect(scenarioEffectIssues(pair(-500), reference)).toEqual([]);
    });

    it('rejects an AI effect outside the floor, saying the move changes almost nothing', () => {
      expect(scenarioEffectIssues(pair(5_000), reference).join(' ')).toMatch(/almost nothing/);
      expect(scenarioEffectIssues(pair(-5_000), reference).join(' ')).toMatch(/almost nothing/);
    });
  });

  it('judges a negative rules effect (a move that costs) by the same ratios and the same sign', () => {
    const reference = pair(-5_000);
    expect(scenarioEffectIssues(pair(-7_500), reference)).toEqual([]);
    expect(scenarioEffectIssues(pair(5_000), reference).length).toBeGreaterThan(0);
    expect(scenarioEffectIssues(pair(-25_000), reference).length).toBeGreaterThan(0);
  });

  it('compares effects, not levels: a base 30% off with the right effect passes', () => {
    const reference = pair(5_000);
    const shifted = { base: at120(base * 1.3), scenario: at120(base * 1.3 + 5_000) };
    expect(scenarioEffectIssues(shifted, reference)).toEqual([]);
  });

  it('takes an explicit envelope', () => {
    const reference = pair(5_000);
    const strict = { ...aiForecastSanity.value, effectFloor: 0, effectRatioMax: 1.2 };
    expect(scenarioEffectIssues(pair(7_500), reference, strict).length).toBeGreaterThan(0);
    expect(scenarioEffectIssues(pair(5_500), reference, strict)).toEqual([]);
  });

  describe('programmer errors throw instead of blaming the model', () => {
    const reference = pair(5_000);

    it.each([['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY], ['-Infinity', Number.NEGATIVE_INFINITY]])(
      'throws RangeError for a reference effect of %s',
      (_label, bad) => {
        expect(() => scenarioEffectIssues(pair(5_000), { base: at120(base), scenario: at120(bad) })).toThrow(RangeError);
        expect(() => scenarioEffectIssues(pair(5_000), { base: at120(bad), scenario: at120(base) })).toThrow(RangeError);
        expect(() => scenarioEffectIssues(pair(5_000), { base: at120(bad), scenario: at120(bad) })).toThrow(RangeError);
      },
    );

    it('a non-finite candidate effect is still an issue, not a throw', () => {
      expect(scenarioEffectIssues(pair(Number.NaN), reference).join(' ')).toMatch(/finite/);
      expect(scenarioEffectIssues({ base: at120(Number.NaN), scenario: at120(base) }, reference).join(' ')).toMatch(/finite/);
    });

    it.each(['candidate.base', 'candidate.scenario', 'reference.base', 'reference.scenario'])(
      'throws RangeError when %s is in other dollars than the other three',
      (which) => {
        const inReal = (f: Forecast): Forecast => ({ ...f, todaysDollars: true });
        const c = pair(5_000);
        const r = pair(5_000);
        if (which === 'candidate.base') c.base = inReal(c.base);
        if (which === 'candidate.scenario') c.scenario = inReal(c.scenario);
        if (which === 'reference.base') r.base = inReal(r.base);
        if (which === 'reference.scenario') r.scenario = inReal(r.scenario);
        expect(() => scenarioEffectIssues(c, r)).toThrow(RangeError);
      },
    );

    it('accepts four forecasts that are all in today’s dollars', () => {
      const inReal = (f: Forecast): Forecast => ({ ...f, todaysDollars: true });
      const real = (effect: number) => ({ base: inReal(at120(base)), scenario: inReal(at120(base + effect)) });
      expect(scenarioEffectIssues(real(5_900), real(5_000))).toEqual([]);
      expect(scenarioEffectIssues(real(25_000), real(5_000)).length).toBeGreaterThan(0);
    });
  });

  it('a real rules pair passes against itself', () => {
    const p = profileDemo;
    const b = forecast(p, 10, { rates });
    const s = forecast(applyPatch(p, { spending: { eatingOut: 200 } }), 10, { rates });
    expect(s.in10y.mid - b.in10y.mid).toBeGreaterThan(0);
    expect(scenarioEffectIssues({ base: b, scenario: s }, { base: b, scenario: s })).toEqual([]);
  });
});
