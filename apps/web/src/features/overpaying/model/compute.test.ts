import { describe, expect, it, vi } from 'vitest';
import { areaDataSample, cloneProfileDemo } from '@/fixtures';
import { computeOverpaying, type ComputeArgs } from './compute';
import { emptyInputs } from './inputs';
import { SAMPLE_METRO, UNCOVERED_ZIP, fakeDeps, sampleOverpayingResult } from './testUtils';
import type { OverpayingDeps, OverpayingInputsVM } from './types';

const area75206 = areaDataSample.find((a) => a.zip === '75206')!;
const area75216 = areaDataSample.find((a) => a.zip === '75216')!;

type Overrides = Omit<Partial<ComputeArgs>, 'inputs' | 'deps'> & { inputs?: Partial<OverpayingInputsVM> };

function args(over: Overrides = {}, deps: OverpayingDeps = fakeDeps()): ComputeArgs {
  const { inputs, ...rest } = over;
  return { inputs: { ...emptyInputs(), zip: '75206', amounts: { rent: 3000, carInsurance: null, groceries: null, childcare: null }, ...inputs }, metro: { metro: null, tier: null }, profile: null, deps, ...rest };
}

describe('computeOverpaying: what is still missing', () => {
  it('asks for a ZIP first; nothing is checked', () => {
    const deps = fakeDeps();
    const out = computeOverpaying(args({ inputs: { zip: '' } }, deps));
    expect(out.coverage).toEqual({ kind: 'empty' });
    expect(out.needs).toBe('zip');
    expect(out.result).toBeNull();
    expect(out.invalidFields).toEqual([]);
    expect(deps.check).not.toHaveBeenCalled();
  });

  it('a ZIP that is not a US ZIP is invalid, not "not covered"', () => {
    const deps = fakeDeps();
    for (const zip of ['SW1A 1AA', 'Москва', '7520']) {
      const out = computeOverpaying(args({ inputs: { zip } }, deps));
      expect(out.coverage).toEqual({ kind: 'invalid' });
      expect(out.invalidFields).toEqual(['zip']);
      expect(out.needs).toBe('zip');
      expect(out.result).toBeNull();
    }
    expect(deps.check).not.toHaveBeenCalled();
  });

  it('with a covered ZIP and all four amounts blank, asks for one amount', () => {
    const deps = fakeDeps();
    const out = computeOverpaying(args({ inputs: { amounts: { rent: null, carInsurance: null, groceries: null, childcare: null } } }, deps));
    expect(out.coverage).toEqual({ kind: 'exact', zip: '75206', metro: SAMPLE_METRO });
    expect(out.needs).toBe('amount');
    expect(out.result).toBeNull();
    expect(deps.check).not.toHaveBeenCalled();
  });

  it('an amount of 0, a negative one or a non-number blocks the result and names the box', () => {
    const deps = fakeDeps();
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const out = computeOverpaying(args({ inputs: { amounts: { rent: 1500, carInsurance: bad, groceries: null, childcare: null } } }, deps));
      expect(out.invalidFields, String(bad)).toEqual(['carInsurance']);
      expect(out.result).toBeNull();
    }
    expect(deps.check).not.toHaveBeenCalled();
  });
});

describe('computeOverpaying: coverage', () => {
  it('a ZIP in the data is compared exactly, with that ZIP\'s area', () => {
    const deps = fakeDeps();
    const out = computeOverpaying(args({}, deps));
    expect(out.coverage).toEqual({ kind: 'exact', zip: '75206', metro: SAMPLE_METRO });
    expect(out.needs).toBeNull();
    expect(deps.check).toHaveBeenCalledTimes(1);
    expect(deps.check.mock.calls[0]![1]).toBe(area75206);
    expect(deps.check.mock.calls[0]![3]).toEqual({ coverage: 'exact' });
    expect(out.result?.status).toBe('ready');
  });

  it('ZIP+4 and spaces find the same area', () => {
    const deps = fakeDeps();
    computeOverpaying(args({ inputs: { zip: ' 75216-0001 ' } }, deps));
    expect(deps.check.mock.calls[0]![1]).toBe(area75216);
  });

  it('a ZIP we do not have asks for a metro: no result, the engine is not called', () => {
    const deps = fakeDeps();
    const out = computeOverpaying(args({ inputs: { zip: UNCOVERED_ZIP } }, deps));
    expect(out.coverage).toEqual({ kind: 'none', zip: UNCOVERED_ZIP });
    expect(out.needs).toBe('metro');
    expect(out.result).toBeNull();
    expect(deps.check).not.toHaveBeenCalled();
  });

  it('a chosen metro and area type give an approximate result, flagged metro', () => {
    const deps = fakeDeps();
    const out = computeOverpaying(args({ inputs: { zip: UNCOVERED_ZIP }, metro: { metro: SAMPLE_METRO, tier: 'cheap' } }, deps));
    expect(out.coverage).toEqual({ kind: 'metro', zip: UNCOVERED_ZIP, metro: SAMPLE_METRO, tier: 'cheap' });
    expect(out.needs).toBeNull();
    expect(deps.check.mock.calls[0]![1]).toBe(area75216); // the representative area of Dallas-Fort Worth, cheap
    expect(deps.check.mock.calls[0]![3]).toEqual({ coverage: 'metro' });
    expect(out.result?.status).toBe('ready');
  });

  it('a metro choice does not matter once the ZIP is covered', () => {
    const deps = fakeDeps();
    const out = computeOverpaying(args({ metro: { metro: SAMPLE_METRO, tier: 'cheap' } }, deps));
    expect(out.coverage.kind).toBe('exact');
    expect(deps.check.mock.calls[0]![1]).toBe(area75206);
  });

  it('a metro and tier the data does not have leave the ZIP uncovered', () => {
    const deps = fakeDeps();
    const out = computeOverpaying(args({ inputs: { zip: UNCOVERED_ZIP }, metro: { metro: 'Boise, ID', tier: 'expensive' } }, deps));
    expect(out.coverage).toEqual({ kind: 'none', zip: UNCOVERED_ZIP });
    expect(deps.check).not.toHaveBeenCalled();
  });

  it('the typed ZIP wins over the profile\'s, and the profile is only passed on, never changed', () => {
    const deps = fakeDeps();
    const profile = cloneProfileDemo(); // zip 75206
    const before = structuredClone(profile);
    computeOverpaying(args({ inputs: { zip: '75216' }, profile }, deps));
    expect(deps.check.mock.calls[0]![1]).toBe(area75216);
    expect(deps.check.mock.calls[0]![2]).toBe(profile);
    expect(profile).toEqual(before);
  });
});

describe('computeOverpaying: what goes to the engine', () => {
  it('only the amounts entered, the household, and the kids by age band', () => {
    const deps = fakeDeps();
    computeOverpaying(args({
      inputs: { bedrooms: 3, adults: 2, kids: { infant: 1, toddler: 0, preschool: 0, schoolAge: 2 }, amounts: { rent: 2400, carInsurance: null, groceries: 900, childcare: null } },
    }, deps));
    expect(deps.check.mock.calls[0]![0]).toEqual({
      bedrooms: 3, adults: 2, kids: ['infant', 'schoolAge', 'schoolAge'], rent: 2400, groceries: 900,
    });
  });

  it('no profile means none is passed (so no 10-year effect is invented)', () => {
    const deps = fakeDeps();
    computeOverpaying(args({}, deps));
    expect(deps.check.mock.calls[0]![2]).toBeUndefined();
  });
});

describe('computeOverpaying: the result', () => {
  it('is the engine\'s numbers as rows and a summary, with the profile\'s effects when a profile was given', () => {
    const out = computeOverpaying(args({ profile: cloneProfileDemo() }));
    expect(out.result?.status).toBe('ready');
    if (out.result?.status !== 'ready') return;
    expect(out.result.data.summary).toMatchObject({ compared: 4, above: 2, effect10y: 49_000 });
    expect(out.result.data.effectAvailable).toBe(true);
  });

  it('childcare with no children is reported as such, not as missing data', () => {
    const deps = fakeDeps({ result: { ...sampleOverpayingResult(), lines: [], skipped: [{ line: 'childcare', reason: 'noData' }] } });
    const out = computeOverpaying(args({ inputs: { amounts: { rent: null, carInsurance: null, groceries: null, childcare: 700 } } }, deps));
    expect(out.result?.status === 'ready' && out.result.data.skipped).toEqual([{ line: 'childcare', reason: 'noKids' }]);
  });

  it('reports "not implemented (M10)" while the engine is not wired in', () => {
    const deps = { ...fakeDeps(), check: undefined };
    const out = computeOverpaying(args({}, deps));
    expect(out.result).toEqual({ status: 'error', error: { kind: 'notImplemented', task: 'M10' } });
  });

  it('turns an engine error into an error state instead of throwing', () => {
    const deps = fakeDeps();
    deps.check.mockImplementation(() => {
      throw new RangeError('Invalid rent');
    });
    const out = computeOverpaying(args({}, deps));
    expect(out.result).toEqual({ status: 'error', error: { kind: 'unknown', message: 'Invalid rent' } });
  });

  it('refuses a result that breaks the contract rather than showing its numbers', () => {
    const bad = sampleOverpayingResult();
    bad.lines[0]!.position = 'below'; // 3000 against 1784–2676 is above
    const out = computeOverpaying(args({}, fakeDeps({ result: bad })));
    expect(out.result).toEqual({ status: 'error', error: { kind: 'invalidResponse' } });
  });
});

describe('computeOverpaying: the signature of a set of inputs', () => {
  const sig = (a: ComputeArgs) => computeOverpaying(a).signature;
  it('is the same for the same inputs however they were typed, and differs when any input differs', () => {
    const base = sig(args());
    expect(base).not.toBeNull();
    expect(sig(args({ inputs: { zip: ' 75206-1234 ' } }))).toBe(base);
    expect(sig(args({ inputs: { amounts: { rent: 3100, carInsurance: null, groceries: null, childcare: null } } }))).not.toBe(base);
    expect(sig(args({ inputs: { zip: '75216' } }))).not.toBe(base);
    expect(sig(args({ inputs: { bedrooms: 1 } }))).not.toBe(base);
    expect(sig(args({ inputs: { adults: 2 } }))).not.toBe(base);
    expect(sig(args({ inputs: { kids: { infant: 1, toddler: 0, preschool: 0, schoolAge: 0 } } }))).not.toBe(base);
  });

  it('is null when there is nothing to compare', () => {
    expect(sig(args({ inputs: { zip: '' } }))).toBeNull();
  });
});

describe('computeOverpaying: does not mutate its inputs', () => {
  it('leaves the arguments alone', () => {
    const a = args({ profile: cloneProfileDemo() });
    const copy = structuredClone({ inputs: a.inputs, metro: a.metro, profile: a.profile });
    computeOverpaying(a);
    expect({ inputs: a.inputs, metro: a.metro, profile: a.profile }).toEqual(copy);
    vi.restoreAllMocks();
  });
});
