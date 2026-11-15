// From the engine's OverpayingResult to what the screen shows: rows with a range bar, the lines that
// were skipped and why, and the summary. Pure; every number is the engine's, none is made here except
// the bar's positions and the sums.
import type { Benchmark, OverpayingResult } from '@lifeguessr/types';
import type { BenchmarkRowVM, Money, OverpayingResultVM, OverpayingSummaryVM, RangeBarVM, SkippedLineVM } from './types';

/**
 * Share of the data's span added on each side of the range bar, so the markers do not sit on its ends.
 * The axis is not anchored at zero: a $1,580–$1,940 range would otherwise be a thin sliver. The
 * numbers under the bar say where it starts and ends.
 */
export const RANGE_BAR_PADDING = 0.3;

/** The typical range and your amount as positions (0–1) on one padded linear axis. */
export function rangeBar(yours: Money, typical: { low: Money; mid: Money; high: Money }): RangeBarVM {
  const lo = Math.min(typical.low, yours);
  const hi = Math.max(typical.high, yours);
  const pad = (hi - lo) * RANGE_BAR_PADDING;
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const width = max - min;
  const at = (v: Money) => (width > 0 ? (v - min) / width : 0.5);
  return { min, max, low: at(typical.low), mid: at(typical.mid), high: at(typical.high), yours: at(yours) };
}

function rowOf(b: Benchmark, profileUsed: boolean): BenchmarkRowVM {
  // Without a profile the engine reports 0 for every line, and it also reports 0 for an above-range line the
  // profile's spending is too small to take the change. A real effect of closing a gap is always above 0, so
  // anything else is "no effect to show", not "an effect of $0".
  const effect10y = profileUsed && b.position === 'above' && b.effect10y > 0 ? b.effect10y : null;
  return {
    line: b.line,
    yours: b.yours,
    typical: { ...b.typical },
    source: b.source,
    isEstimate: b.isEstimate,
    position: b.position,
    gapPerMonth: b.gapPerMonth,
    gapPerYear: b.gapPerYear,
    toMiddlePerMonth: b.position === 'above' ? b.yours - b.typical.mid : null,
    effect10y,
    bar: rangeBar(b.yours, b.typical),
  };
}

function summaryOf(rows: BenchmarkRowVM[], profileUsed: boolean): OverpayingSummaryVM {
  const above = rows.filter((r) => r.position === 'above');
  const withEffect = above.filter((r) => r.effect10y !== null);
  // A total is only a total when it covers every line above the range; with some missing it would read as
  // the whole and be too small, so each line shows its own instead.
  const effectStatus: OverpayingSummaryVM['effectStatus'] =
    above.length === 0
      ? 'notApplicable'
      : !profileUsed
        ? 'needsProfile'
        : withEffect.length === above.length
          ? 'total'
          : withEffect.length === 0
            ? 'none'
            : 'partial';
  const verdict: OverpayingSummaryVM['verdict'] =
    above.length > 0 ? 'above' : rows.length > 0 && rows.every((r) => r.position === 'below') ? 'below' : 'typical';
  return {
    verdict,
    nextSteps: [...above].sort((a, b) => b.gapPerYear - a.gapPerYear).map((r) => ({ line: r.line, mid: r.typical.mid })),
    compared: rows.length,
    above: above.length,
    gapPerYear: rows.reduce((sum, r) => sum + r.gapPerYear, 0),
    effect10y: effectStatus === 'total' ? withEffect.reduce((sum, r) => sum + r.effect10y!, 0) : null,
    effectStatus,
  };
}

/**
 * `profileUsed`: a profile of the person's own went to the engine, so its 10-year effects mean something.
 * `kidCount`: children entered; childcare entered without any is reported as `noKids`, not as missing data.
 */
export function toResultVM(result: OverpayingResult, ctx: { profileUsed: boolean; kidCount: number }): OverpayingResultVM {
  const rows = result.lines.map((b) => rowOf(b, ctx.profileUsed));
  const skipped: SkippedLineVM[] = result.skipped.map(({ line, reason }) => ({
    line,
    reason: reason === 'noData' && line === 'childcare' && ctx.kidCount === 0 ? 'noKids' : reason,
  }));
  return { rows, skipped, summary: summaryOf(rows, ctx.profileUsed), effectAvailable: ctx.profileUsed };
}
