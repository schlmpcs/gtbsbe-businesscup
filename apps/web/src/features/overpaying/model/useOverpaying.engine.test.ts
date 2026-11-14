// @vitest-environment jsdom
// The view-model on the REAL overpayingCheck over areaData.sample.json: the issue's "view-model on
// areaData.sample.json" tests. overpayingCheck (issue #86) is on main but not yet exported from
// @lifeguessr/engine in this branch (M1 has to be reconciled with main first), so these are skipped
// until it is, and then run with no edit. Expected numbers are worked by hand from the sample data
// for 75206 (mid tier), 2 bedrooms, 1 adult:
//   rent         $2,230 (no Census ratio, so ±20%)            → $1,784 to $2,676
//   car insurance $150 ±20%                                     → $120 to $180
//   groceries    $367.95 per adult, plus 0.7 of that per child, ±15%: one adult and an infant is $625.515 → $531.68775 to $719.34225
//   childcare    $840.67 for one infant ±20%                    → $672.536 to $1,008.804
import * as engine from '@lifeguessr/engine';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { areaDataSample, cloneProfileDemo } from '@/fixtures';
import { resetClientState, waitForReady } from '@/test/clientState';
import { SAMPLE_METRO, UNCOVERED_ZIP, fakeDeps, sampleAreaForMetro } from './testUtils';
import type { OverpayingCheckFn, OverpayingDeps, OverpayingVM } from './types';
import { useOverpaying } from './useOverpaying';

const check = (engine as unknown as { overpayingCheck?: OverpayingCheckFn }).overpayingCheck;

beforeEach(resetClientState);

function realDeps(over: Partial<OverpayingDeps> = {}): OverpayingDeps {
  return { ...fakeDeps(), check, ...over };
}

async function setup(profile: Parameters<typeof useOverpaying>[0], deps: OverpayingDeps = realDeps()) {
  const rendered = renderHook(() => useOverpaying(profile, { deps }));
  await waitForReady(rendered.result);
  return { ...rendered, vm: () => rendered.result.current as OverpayingVM };
}

function rowsOf(vm: OverpayingVM) {
  const r = vm.result;
  if (r?.status !== 'ready') throw new Error(`expected a result, got ${JSON.stringify(r)}`);
  return r.data;
}

describe.skipIf(!check)('useOverpaying on the real overpayingCheck (areaData.sample.json)', () => {
  it('each position, the gap per year and the total, without a profile', async () => {
    const { vm } = await setup(null);
    act(() => {
      vm().setZip('75206');
      vm().setKidCount('infant', 1);
      vm().setAmount('rent', 3000); //         above $2,676 by $324 a month
      vm().setAmount('carInsurance', 100); //  below $120
      vm().setAmount('groceries', 600); //     inside $531.69 to $719.34
      vm().setAmount('childcare', 1500); //    above $1,008.804 by $491.196 a month
    });
    const data = rowsOf(vm());
    expect(data.rows.map((r) => [r.line, r.position])).toEqual([
      ['rent', 'above'], ['carInsurance', 'below'], ['groceries', 'inRange'], ['childcare', 'above'],
    ]);
    expect(data.rows[0]!.typical.low).toBeCloseTo(1784, 6);
    expect(data.rows[0]!.typical.high).toBeCloseTo(2676, 6);
    expect(data.rows[0]!.gapPerYear).toBeCloseTo(324 * 12, 6); // 3 888
    expect(data.rows[3]!.gapPerYear).toBeCloseTo(491.196 * 12, 6); // 5 894.352
    expect(data.rows.map((r) => r.isEstimate)).toEqual([true, true, true, true]); // no Census ratio for this sample ZIP: assumed spreads
    expect(data.summary).toMatchObject({ compared: 4, above: 2, effect10y: null, effectStatus: 'needsProfile' });
    expect(data.summary.gapPerYear).toBeCloseTo(9782.352, 6);
    expect(data.effectAvailable).toBe(false);
  });

  it('with the demo profile: the 10-year effect is about the monthly change over 120 months, and only where it can be worked out', async () => {
    const { vm } = await setup(cloneProfileDemo());
    act(() => {
      vm().setKidCount('infant', 1);
      vm().setAmount('rent', 3000);
      vm().setAmount('childcare', 1500);
    });
    const data = rowsOf(vm());
    // Rent: the profile's $1,950 can take the $770 change (3000 − the $2,230 middle); about 770 × 120 = $92,400 in today's dollars.
    const rent = data.rows.find((r) => r.line === 'rent')!;
    expect(rent.effect10y).toBeGreaterThan(92_400 * 0.85);
    expect(rent.effect10y).toBeLessThan(92_400 * 1.15);
    expect(rent.toMiddlePerMonth).toBeCloseTo(770, 6); // the monthly figure that effect is for: 3000 − 2230
    // Childcare: the profile has $0 of it, so a $659 change cannot come out of it: no effect to show.
    expect(data.rows.find((r) => r.line === 'childcare')!.effect10y).toBeNull();
    // Two lines are above the range and only one has an effect: no total, rather than a partial sum.
    expect(data.summary).toMatchObject({ above: 2, effect10y: null, effectStatus: 'partial' });
    expect(data.effectAvailable).toBe(true);
  });

  it('a ZIP outside the data with a metro chosen is flagged metro and every line is an estimate', async () => {
    const { vm } = await setup(null);
    act(() => {
      vm().setZip(UNCOVERED_ZIP);
      vm().setAmount('rent', 2000);
    });
    expect(vm().result).toBeNull();
    act(() => vm().metroPicker!.setMetro(SAMPLE_METRO)); // mid tier: 75206, so rent $2,230 → $1,784 to $2,676
    expect(vm().coverage).toEqual({ kind: 'metro', zip: UNCOVERED_ZIP, metro: SAMPLE_METRO, tier: 'mid' });
    const data = rowsOf(vm());
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ line: 'rent', position: 'inRange', isEstimate: true });
  });

  it('bedrooms above the data count as 4, and the household sizes the groceries range', async () => {
    const { vm } = await setup(null);
    act(() => {
      vm().setZip('75206');
      vm().setBedrooms(6);
      vm().setAdults(2);
      vm().setAmount('rent', 3000); //      4 bedrooms: $3,570 ±20% = $2,856 to $4,284: in range
      vm().setAmount('groceries', 900); //  2 adults: $735.90 ±15% = $625.515 to $846.285: above by $53.715
    });
    const data = rowsOf(vm());
    expect(data.rows[0]).toMatchObject({ line: 'rent', position: 'inRange' });
    expect(data.rows[0]!.typical.mid).toBeCloseTo(3570, 6);
    expect(data.rows[1]!.typical.mid).toBeCloseTo(735.9, 6);
    expect(data.rows[1]!.gapPerMonth).toBeCloseTo(53.715, 6);
  });

  it('childcare: no data in the area is not the same as no children', async () => {
    const mid = areaDataSample.find((a) => a.zip === '75206')!;
    const noChildcareArea = { ...mid, childcareMonthly: undefined };
    const deps = realDeps({ areas: { forZip: (z) => (z === '75206' ? noChildcareArea : null), zipCount: 1 }, metros: { list: () => [], forMetro: sampleAreaForMetro } });
    const { vm } = await setup(null, deps);
    act(() => {
      vm().setZip('75206');
      vm().setAmount('childcare', 900);
    });
    expect(rowsOf(vm()).skipped).toContainEqual({ line: 'childcare', reason: 'noKids' });
    act(() => vm().setKidCount('toddler', 1));
    expect(rowsOf(vm()).skipped).toContainEqual({ line: 'childcare', reason: 'noData' });
  });
});

// Visible in the test output while the engine is not exported here.
describe.skipIf(!!check)('useOverpaying on the real overpayingCheck (waits on #86 in this branch)', () => {
  it.todo('each position, the gap per year and the total, without a profile');
  it.todo('with the demo profile: the 10-year effect');
  it.todo('a ZIP outside the data with a metro chosen is flagged metro');
  it.todo('bedrooms above the data count as 4; the household sizes the groceries range');
  it.todo('childcare: no data in the area is not the same as no children');
});
