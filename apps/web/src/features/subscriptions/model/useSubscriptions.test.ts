// @vitest-environment jsdom
// The subscription audit's view-model on fakes: the catalogue, the tool's slice of the local store, the
// statement categorizer and the event sender are all injected (apps/web/src/test/subscriptions.ts).
import { subscriptionsExpected } from '@lifeguessr/data/fixtures/tools';
import { applyPatch, forecast, rankCandidates } from '@lifeguessr/engine';
import { statementItemsSample } from '@lifeguessr/data/fixtures/tools';
import { ClientEventEnvelopeSchema, type ClientFunnelEvent, type StatementCategorizeResponse } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/http';
import { areaRates } from '@/lib/model/profile';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { aiAnswer, mockForecastRoute } from '@/test/forecastApi';
import { csvFile, fakeCategorize, realisticCatalogue, ruleClasses, sampleStatementFile, testCatalogue, useMemoryStore } from '@/test/subscriptions';
import { CANCEL_MOVE_ID, cancelCandidate } from './audit';
import { SubscriptionsToolStateSchema, type SubscriptionsToolState } from './state';
import { useCancelResult } from './useCancelResult';
import { useSubscriptions, type SubscriptionsDeps } from './useSubscriptions';

const track = vi.fn<NonNullable<SubscriptionsDeps['track']>>();
const downloadRenewals = vi.fn<NonNullable<SubscriptionsDeps['downloadRenewals']>>(() => 'downloaded');

type Options = Partial<Pick<SubscriptionsDeps, 'catalogue' | 'categorize'>> & { initial?: SubscriptionsToolState };

function renderTool(opts: Options = {}) {
  const view = renderHook(() => {
    const store = useMemoryStore(opts.initial);
    const profile = useAppStore((s) => s.profile);
    const vm = useSubscriptions(profile, {
      catalogue: opts.catalogue ?? testCatalogue, store, track, downloadRenewals,
      categorize: opts.categorize ?? fakeCategorize(),
    });
    // The screen mounts this only while something is marked (SubscriptionsTool); here it is always there.
    const cancel = useCancelResult(profile, vm.plan.candidate, { track });
    return { vm, store, cancel };
  });
  return view;
}
type Tool = ReturnType<typeof renderTool>;

const ready = (tool: Tool) => waitFor(() => expect(tool.result.current.vm.status).toBe('ready'));

/** Reads a statement and waits for its findings to land. */
async function uploaded(tool: Tool, file: File = sampleStatementFile()) {
  act(() => tool.result.current.vm.statement.upload(file));
  await waitFor(() => expect(tool.result.current.vm.statement.status).not.toBe('reading'));
}

beforeEach(() => {
  resetClientState();
  track.mockClear();
  downloadRenewals.mockClear();
  mockForecastRoute();
});

describe('cold path: no profile, no upload', () => {
  it('starts on the guess; tools open is counted once the saved state is read', async () => {
    const tool = renderTool();
    await ready(tool);
    const { vm } = tool.result.current;
    expect(vm.step).toBe('guess');
    expect(vm.steps.map((s) => [s.id, s.available])).toEqual([
      ['guess', true], ['ticks', true], ['reveal', false], ['statement', true], ['findings', false], ['plan', false],
    ]);
    expect(vm.guess).toMatchObject({ value: null, presets: [25, 50, 100, 200] });
    expect(vm.canReveal).toBe(false);
    expect(track).toHaveBeenCalledWith({ name: 'tool_opened', props: { tool: 'subscriptions' } }, { once: 'tool:subscriptions' });
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('the tick-list is the catalogue by category, ambiguous services and free plans left out', async () => {
    const tool = renderTool();
    await ready(tool);
    const groups = tool.result.current.vm.ticks.groups;
    expect(groups.map((g) => [g.category, g.services.map((s) => s.serviceId)])).toEqual([
      ['video', ['netflix', 'disney-plus']],
      ['music', ['spotify']],
      ['fitness', ['planet-fitness', 'quarterly-gym']],
      ['other', ['amazon-prime']],
    ]);
    const netflix = groups[0]!.services[0]!;
    expect(netflix).toMatchObject({ ticked: false, priceYear: 2026, isEstimate: true, plan: { id: 'ads', price: 7.99, monthly: 7.99 } });
    expect(netflix.plans.map((p) => p.id)).toEqual(['ads', 'standard', 'premium']);
    expect(netflix.source).toEqual({ name: 'Test catalogue (public price pages)', year: 2026 });
    const prime = groups.flatMap((g) => g.services).find((s) => s.serviceId === 'amazon-prime')!;
    expect(prime.plan).toMatchObject({ cadence: 'yearly', price: 139, monthly: 11.58 }); // 139 ÷ 12 = 11.5833…
  });

  it('a tick price is always an estimate, whatever the catalogue says about its price (no statement has been shown)', async () => {
    const tool = renderTool({ catalogue: realisticCatalogue });
    await ready(tool);
    const services = tool.result.current.vm.ticks.groups.flatMap((g) => g.services);
    expect(services.map((s) => [s.serviceId, s.plans.length, s.isEstimate])).toEqual([
      ['netflix', 1, true], ['spotify', 1, true], ['planet-fitness', 1, true],
    ]);
  });

  it('ticking: a service with its default plan, another plan on a second tap, off on the same plan; the total follows', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'standard'));
    expect(tool.result.current.vm.ticks).toMatchObject({ count: 1, monthly: 17.99, yearly: 215.88 });
    act(() => tool.result.current.vm.ticks.toggle('spotify')); // default plan: individual $11.99
    expect(tool.result.current.vm.ticks).toMatchObject({ count: 2, monthly: 29.98, yearly: 359.76 }); // 17.99 + 11.99; × 12
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'premium')); // change plan
    expect(tool.result.current.vm.ticks).toMatchObject({ count: 2, monthly: 36.98 }); // 24.99 + 11.99
    const netflix = tool.result.current.vm.ticks.groups[0]!.services[0]!;
    expect(netflix).toMatchObject({ ticked: true, plan: { id: 'premium' } });
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'premium')); // same plan: off
    expect(tool.result.current.vm.ticks).toMatchObject({ count: 1, monthly: 11.99 });
    expect(tool.result.current.store.state!.ticks).toEqual([{ serviceId: 'spotify', planId: 'individual' }]);
  });

  it('ignores a service or plan the catalogue does not have, and drops saved ticks it no longer lists', async () => {
    const tool = renderTool({ initial: { ticks: [{ serviceId: 'gone', planId: 'x' }, { serviceId: 'netflix', planId: 'standard' }], confirmed: [], dismissed: [], cancelMarked: [] } });
    await ready(tool);
    expect(tool.result.current.vm.ticks.count).toBe(1); // 'gone' is not counted
    act(() => tool.result.current.vm.ticks.toggle('no-such-service'));
    act(() => tool.result.current.vm.ticks.toggle('spotify', 'no-such-plan'));
    expect(tool.result.current.store.state!.ticks).toEqual([{ serviceId: 'gone', planId: 'x' }, { serviceId: 'netflix', planId: 'standard' }]);
    act(() => tool.result.current.vm.ticks.toggle('spotify'));
    expect(tool.result.current.store.state!.ticks).toEqual([{ serviceId: 'netflix', planId: 'standard' }, { serviceId: 'spotify', planId: 'individual' }]);
  });

  it('counts the start of the tick path once', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.ticks.toggle('netflix'));
    act(() => tool.result.current.vm.ticks.toggle('spotify'));
    const started = track.mock.calls.filter(([e]) => e.name === 'subs_started');
    expect(started).toEqual([[{ name: 'subs_started', props: { path: 'tickList' } }, { once: 'subs:started:tickList' }]]);
  });
});

describe('guess and reveal', () => {
  const tickThree = (tool: Tool) => {
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'standard'));
    act(() => tool.result.current.vm.ticks.toggle('spotify', 'individual'));
    act(() => tool.result.current.vm.ticks.toggle('planet-fitness'));
  };

  it('a guess of $40 against ticks of $54.97 is 0.73 of it: bucket 0.5 to 0.8, a guess below', async () => {
    // 17.99 + 11.99 + 24.99 = 54.97; 40 ÷ 54.97 = 0.7277…; 0.5 × 54.97 = 27.49 ≤ 40 < 0.8 × 54.97 = 43.98
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.guess.set(40));
    tickThree(tool);
    const { reveal } = tool.result.current.vm;
    expect(reveal).toMatchObject({
      guess: 40, against: 'ticks', actual: 54.97, actualYearly: 659.64, miss: '0.5to0.8', direction: 'lower', gap: 14.97, // 54.97 − 40
      ticks: { count: 3, monthly: 54.97, priceYear: 2026 }, statement: null,
      survey: { guessed: 86, itemized: 219, source: { name: 'C+R Research survey of 1,000 consumers', year: 2022 } },
    });
    expect(reveal.missFactor).toBeCloseTo(0.7277, 4);
    expect(tool.result.current.vm.canReveal).toBe(true);
  });

  it('a guess above, a guess of 0, and a close one', async () => {
    const tool = renderTool();
    await ready(tool);
    tickThree(tool); // $54.97
    act(() => tool.result.current.vm.guess.set(200)); // 3.64 ×
    expect(tool.result.current.vm.reveal).toMatchObject({ miss: 'over2', direction: 'higher', gap: 145.03 }); // 200 − 54.97
    act(() => tool.result.current.vm.guess.set(0));
    expect(tool.result.current.vm.reveal).toMatchObject({ guess: 0, miss: 'under0.5', direction: 'lower' });
    expect(tool.result.current.vm.reveal.missFactor).toBe(0);
    act(() => tool.result.current.vm.guess.set(55));
    expect(tool.result.current.vm.reveal).toMatchObject({ miss: '0.8to1.25', direction: 'close' });
  });

  it('no guess: the total alone, no factor, no bucket; clearing the guess forgets it', async () => {
    const tool = renderTool();
    await ready(tool);
    tickThree(tool);
    expect(tool.result.current.vm.reveal).toMatchObject({ guess: null, actual: 54.97, missFactor: null, miss: null, direction: null });
    act(() => tool.result.current.vm.guess.set(40));
    act(() => tool.result.current.vm.guess.set(null));
    expect(tool.result.current.vm.guess.value).toBeNull();
    expect('guess' in tool.result.current.store.state!).toBe(false);
    act(() => tool.result.current.vm.guess.set(-5)); // not a guess
    expect(tool.result.current.vm.guess.value).toBeNull();
  });

  it('nothing ticked and no guess: nothing to reveal; goTo the reveal does nothing', async () => {
    const tool = renderTool();
    await ready(tool);
    expect(tool.result.current.vm.canReveal).toBe(false);
    act(() => tool.result.current.vm.goTo('reveal'));
    expect(tool.result.current.vm.step).toBe('guess');
    act(() => tool.result.current.vm.guess.set(40));
    expect(tool.result.current.vm.canReveal).toBe(false); // a guess alone has nothing to compare with
    expect(tool.result.current.vm.reveal).toMatchObject({ guess: 40, actual: 0, missFactor: null, miss: null });
  });

  it('counts the reveal once, with the bucket and nothing else', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.guess.set(40));
    tickThree(tool);
    act(() => tool.result.current.vm.goTo('reveal'));
    expect(tool.result.current.vm.step).toBe('reveal');
    act(() => tool.result.current.vm.goTo('ticks'));
    act(() => tool.result.current.vm.goTo('reveal'));
    const revealed = track.mock.calls.filter(([e]) => e.name === 'subs_revealed');
    expect(revealed).toEqual([[{ name: 'subs_revealed', props: { miss: '0.5to0.8' } }, { once: 'subs:revealed' }]]);
  });

  it('moves between the steps that are available with next and back', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.next());
    expect(tool.result.current.vm.step).toBe('ticks');
    act(() => tool.result.current.vm.next()); // reveal is not available yet: on to the statement
    expect(tool.result.current.vm.step).toBe('statement');
    act(() => tool.result.current.vm.back());
    expect(tool.result.current.vm.step).toBe('ticks');
    tickThree(tool);
    act(() => tool.result.current.vm.next());
    expect(tool.result.current.vm.step).toBe('reveal');
    act(() => tool.result.current.vm.goTo('findings')); // no statement yet
    expect(tool.result.current.vm.step).toBe('reveal');
    act(() => tool.result.current.vm.back());
    act(() => tool.result.current.vm.back());
    act(() => tool.result.current.vm.back());
    expect(tool.result.current.vm.step).toBe('guess');
  });
});

describe('where the tool starts', () => {
  const empty = { ticks: [], confirmed: [], dismissed: [], cancelMarked: [] };

  const cases: [string, SubscriptionsToolState | undefined, string][] = [
    ['nothing saved', undefined, 'guess'],
    ['a guess only', { ...empty, guess: 40 }, 'ticks'],
    ['ticks only', { ...empty, ticks: [{ serviceId: 'netflix', planId: 'standard' }] }, 'ticks'],
  ];
  it.each(cases)('with %s it starts on %s', async (_name, initial, step) => {
    const tool = renderTool({ initial });
    await ready(tool);
    expect(tool.result.current.vm.step).toBe(step);
  });

  it('with a saved statement it starts on the findings; it does not move on when the state changes later', async () => {
    const first = renderTool();
    await ready(first);
    await uploaded(first);
    const tool = renderTool({ initial: first.result.current.store.state });
    await ready(tool);
    expect(tool.result.current.vm.step).toBe('findings');
    act(() => tool.result.current.vm.goTo('guess'));
    act(() => tool.result.current.vm.guess.set(40));
    expect(tool.result.current.vm.step).toBe('guess'); // typing a guess did not carry the person on
  });

  it('does not start on a step that is not available (saved state that points past what exists)', async () => {
    // A saved audit that is gone from the state when the tool is cleared: it falls back to the guess.
    const first = renderTool();
    await ready(first);
    await uploaded(first);
    act(() => first.result.current.vm.clearLocalData());
    expect(first.result.current.vm.step).toBe('guess');
  });
});

describe('reading a statement: overlapping and abandoned uploads', () => {
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  };
  const answer = (items: readonly { label: string; amount: number }[]): StatementCategorizeResponse => ({
    months: [], categorizedBy: 'rules', classes: ruleClasses(items as never),
  });

  it('a late answer to an earlier file is ignored: the newest file wins, whatever order they come back in', async () => {
    const slow = deferred<StatementCategorizeResponse>();
    let calls = 0;
    const categorize = vi.fn(async (items: readonly { label: string; amount: number }[]) => (++calls === 1 ? slow.promise : answer(items)));
    const tool = renderTool({ categorize: categorize as never });
    await ready(tool);
    act(() => tool.result.current.vm.statement.upload(sampleStatementFile())); // A: waits
    await waitFor(() => expect(categorize).toHaveBeenCalledTimes(1));
    act(() => tool.result.current.vm.statement.upload(csvFile(['2026-10-07,NETFLIX.COM,-17.99', '2026-11-07,NETFLIX.COM,-17.99']))); // B: answers at once
    await waitFor(() => expect(tool.result.current.vm.statement.status).toBe('done'));
    expect(tool.result.current.vm.findings.active.map((f) => f.id)).toEqual(['netflix-com']);
    const saved = tool.result.current.store.saves.length;

    await act(async () => slow.resolve(answer(statementItemsSample))); // A comes back late
    expect(tool.result.current.store.saves).toHaveLength(saved);
    expect(tool.result.current.vm.findings.active.map((f) => f.id)).toEqual(['netflix-com']);
    expect(tool.result.current.vm.statement.status).toBe('done');
    expect(tool.result.current.vm.step).toBe('findings');
  });

  it('an earlier file that fails after a newer one was started does not show its error', async () => {
    const slow = deferred<StatementCategorizeResponse>();
    let calls = 0;
    const categorize = vi.fn(async (items: readonly { label: string; amount: number }[]) => (++calls === 1 ? slow.promise : answer(items)));
    const tool = renderTool({ categorize: categorize as never });
    await ready(tool);
    act(() => tool.result.current.vm.statement.upload(sampleStatementFile()));
    await waitFor(() => expect(categorize).toHaveBeenCalledTimes(1));
    act(() => tool.result.current.vm.statement.upload(csvFile(['2026-10-07,NETFLIX.COM,-17.99', '2026-11-07,NETFLIX.COM,-17.99'])));
    await waitFor(() => expect(tool.result.current.vm.statement.status).toBe('done'));
    await act(async () => { slow.resolve(Promise.reject(new ApiError('Network error', 0)) as never); await Promise.resolve(); });
    expect(tool.result.current.vm.statement).toMatchObject({ status: 'done', error: null });
  });

  it('leaving the page mid-upload saves nothing and updates nothing when the answer arrives', async () => {
    const slow = deferred<StatementCategorizeResponse>();
    const categorize = vi.fn(async () => slow.promise);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tool = renderTool({ categorize: categorize as never });
    await ready(tool);
    act(() => tool.result.current.vm.statement.upload(sampleStatementFile()));
    await waitFor(() => expect(categorize).toHaveBeenCalledTimes(1));
    expect(tool.result.current.vm.statement.status).toBe('reading');
    tool.unmount();
    await act(async () => slow.resolve(answer(statementItemsSample)));
    expect(tool.result.current.store.saves).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('statement path', () => {
  it('finds the golden findings of the sample statement: $69.54 a month, $834.52 a year, five months', async () => {
    const categorize = fakeCategorize();
    const tool = renderTool({ categorize });
    await ready(tool);
    await uploaded(tool);
    const { vm } = tool.result.current;
    expect(vm.statement).toMatchObject({ status: 'done', error: null, monthsCovered: 5, isShort: false, asOf: { month: '2026-11', day: 12 } });
    expect(vm.findings.active.map((f) => f.id)).toEqual(subscriptionsExpected.findings.map((f) => f.id));
    // Flagged: Prime, whose yearly charge was seen once (`seenOnce`); the four monthly ones have no flag.
    expect(vm.findings).toMatchObject({ found: 5, monthly: 69.54, yearly: 834.52, toConfirm: [], stopped: [], tickedOnly: [], forgotten: 0, ticked: 0, flagged: 1 });
    expect(vm.step).toBe('findings');
    expect(categorize.calls).toHaveLength(1);
    expect(categorize.calls[0]!.items).toHaveLength(170); // the masked lines of the sample statement
  });

  it('names a finding by its catalogue service, and keeps the masked label of one it does not know', async () => {
    const tool = renderTool();
    await ready(tool);
    await uploaded(tool);
    const byName = Object.fromEntries(tool.result.current.vm.findings.active.map((f) => [f.id, f.name]));
    expect(byName).toEqual({
      'planet-fitness-club-fees': 'Planet Fitness', 'netflix-com-ca': 'Netflix', 'spotify-usa-ny': 'Spotify',
      'amazon-prime-amzn-com-bill-wa': 'Amazon Prime', 'apple-com-bill-ca': 'APPLE.COM/BILL # CA',
    });
    const prime = tool.result.current.vm.findings.active.find((f) => f.serviceId === 'amazon-prime')!;
    expect(prime).toMatchObject({ cadence: 'yearly', amount: 139, monthly: 11.58, flags: ['seenOnce'], confidence: 'medium', isEstimate: false, origin: 'statement' });
  });

  it('without the Prime entry the totals are the four monthly charges: $57.96 a month, $695.52 a year', async () => {
    // 24.99 + 17.99 + 11.99 + 2.99 = 57.96; × 12 = 695.52
    const tool = renderTool({ catalogue: testCatalogue.filter((s) => s.id !== 'amazon-prime') });
    await ready(tool);
    await uploaded(tool);
    expect(tool.result.current.vm.findings).toMatchObject({ found: 4, monthly: 57.96, yearly: 695.52 });
  });

  it('with ticks: what was found and not ticked is "forgotten" (Planet Fitness, Prime, Apple); the ticked pair is not', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'standard'));
    act(() => tool.result.current.vm.ticks.toggle('spotify', 'individual'));
    await uploaded(tool);
    const { findings } = tool.result.current.vm;
    expect(findings.active.filter((f) => f.forgotten).map((f) => f.id)).toEqual(['planet-fitness-club-fees', 'amazon-prime-amzn-com-bill-wa', 'apple-com-bill-ca']);
    expect(findings).toMatchObject({ found: 5, ticked: 2, forgotten: 3 });
  });

  it('a service ticked and found is counted once, as the statement finding; one ticked and not found stays, as an estimate', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'premium')); // $24.99 ticked; the statement says $17.99
    act(() => tool.result.current.vm.ticks.toggle('disney-plus')); // $7.99, not in the statement
    await uploaded(tool);
    const { findings, plan, apply } = tool.result.current.vm;
    expect(findings.active.filter((f) => f.serviceId === 'netflix')).toHaveLength(1);
    expect(findings.active.find((f) => f.serviceId === 'netflix')).toMatchObject({ amount: 17.99, isEstimate: false, origin: 'statement' });
    expect(findings.tickedOnly.map((f) => [f.id, f.monthly, f.isEstimate, f.origin])).toEqual([['tick:disney-plus', 7.99, true, 'tickList']]);
    expect(findings.monthly).toBe(69.54); // the statement's own total
    expect(plan.options).toHaveLength(6);
    expect(apply.to).toEqual({ value: 77.53, isEstimate: true }); // 69.54 + 7.99, the estimate in it makes it an estimate
  });

  it('the reveal after a statement compares the guess with the statement total, like with like', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.guess.set(86));
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'standard'));
    await uploaded(tool);
    // 86 ÷ 69.54 = 1.2367: just under 1.25
    expect(tool.result.current.vm.reveal).toMatchObject({
      against: 'statement', actual: 69.54, actualYearly: 834.52, miss: '0.8to1.25', direction: 'close',
      ticks: { count: 1, monthly: 17.99 }, statement: { monthly: 69.54, yearly: 834.52, monthsCovered: 5 },
    });
  });

  describe('a pattern that needs the person (low confidence)', () => {
    // Two charges of one unknown merchant that the categorizer calls a subscription: a pattern only, so `low`.
    const mystery = () => csvFile(['2026-10-05,MYSTERY APP,-4.99', '2026-11-05,MYSTERY APP,-4.99'], 'mystery.csv');
    const categorize = () => fakeCategorize((items) => [...new Set(items.map((i) => i.label))].map((label) => ({ label, class: 'subscriptions' as const })));

    it('is "to confirm" and in no total until confirmed; then it counts', async () => {
      const tool = renderTool({ categorize: categorize() });
      await ready(tool);
      await uploaded(tool, mystery());
      let { findings } = tool.result.current.vm;
      expect(findings.toConfirm.map((f) => [f.id, f.confidence, f.counted])).toEqual([['mystery-app', 'low', false]]);
      expect(findings).toMatchObject({ found: 0, monthly: 0, yearly: 0, active: [] });
      expect(tool.result.current.vm.apply.canApply).toBe(false);
      act(() => tool.result.current.vm.findings.confirm('mystery-app'));
      findings = tool.result.current.vm.findings;
      expect(findings.toConfirm).toEqual([]);
      expect(findings.active.map((f) => [f.id, f.counted])).toEqual([['mystery-app', true]]);
      expect(findings).toMatchObject({ found: 1, monthly: 4.99, yearly: 59.88 }); // 4.99 × 12
      expect(tool.result.current.store.state!.confirmed).toEqual(['mystery-app']);
    });

    it('"no" hides it and keeps it out; it can be brought back', async () => {
      const tool = renderTool({ categorize: categorize() });
      await ready(tool);
      await uploaded(tool, mystery());
      act(() => tool.result.current.vm.findings.dismiss('mystery-app'));
      expect(tool.result.current.vm.findings).toMatchObject({ toConfirm: [], active: [], monthly: 0, dismissedCount: 1 });
      act(() => tool.result.current.vm.findings.restoreDismissed());
      expect(tool.result.current.vm.findings.toConfirm.map((f) => f.id)).toEqual(['mystery-app']);
      expect(tool.result.current.vm.findings.dismissedCount).toBe(0);
    });

    it('confirm only works on a finding that is waiting to be confirmed', async () => {
      const tool = renderTool();
      await ready(tool);
      await uploaded(tool);
      act(() => tool.result.current.vm.findings.confirm('netflix-com-ca')); // already counted
      act(() => tool.result.current.vm.findings.confirm('no-such-finding'));
      expect(tool.result.current.store.state!.confirmed).toEqual([]);
    });
  });

  it('a short statement (one month) says so; its findings are medium confidence from the catalogue', async () => {
    const tool = renderTool();
    await ready(tool);
    await uploaded(tool, csvFile(['2026-11-07,NETFLIX.COM,-17.99', '2026-11-08,SOME SHOP,-12.00'], 'short.csv'));
    const { vm } = tool.result.current;
    expect(vm.statement).toMatchObject({ status: 'done', monthsCovered: 1, isShort: true });
    expect(vm.findings.active.map((f) => [f.serviceId, f.confidence, f.chargesSeen])).toEqual([['netflix', 'medium', 1]]);
  });

  it('a statement of two months is not short: two charges are the least the detector reads a pattern from (subsMinCharges)', async () => {
    const tool = renderTool();
    await ready(tool);
    await uploaded(tool, csvFile(['2026-10-07,NETFLIX.COM,-17.99', '2026-11-07,NETFLIX.COM,-17.99']));
    expect(tool.result.current.vm.statement).toMatchObject({ monthsCovered: 2, isShort: false });
  });

  it('a statement with nothing recurring: no findings, totals 0, no factor for a guess', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.guess.set(50));
    await uploaded(tool, csvFile(['2026-10-07,SOME SHOP,-12.00', '2026-11-08,OTHER PLACE,-9.00']));
    const { vm } = tool.result.current;
    expect(vm.findings).toMatchObject({ found: 0, active: [], toConfirm: [], stopped: [], monthly: 0 });
    expect(vm.reveal).toMatchObject({ against: 'statement', actual: 0, missFactor: null, miss: null });
    expect(vm.step).toBe('findings');
  });

  it('a stopped charge is listed apart and counted nowhere', async () => {
    const tool = renderTool();
    await ready(tool);
    // Netflix charged in Jul, Aug, Sep; the statement runs to mid November: not charged for about 2 months.
    await uploaded(tool, csvFile([
      '2026-07-07,NETFLIX.COM,-17.99', '2026-08-07,NETFLIX.COM,-17.99', '2026-09-07,NETFLIX.COM,-17.99', '2026-11-14,SOME SHOP,-3.00',
    ]));
    const { findings } = tool.result.current.vm;
    expect(findings.stopped.map((f) => [f.serviceId, f.status, f.nextExpected])).toEqual([['netflix', 'stopped', null]]);
    expect(findings).toMatchObject({ found: 0, monthly: 0 });
  });

  describe('errors reuse the S9 messages, and ticks still work', () => {
    it.each([
      ['not a CSV', () => new File(['x'], 'statement.pdf', { type: 'application/pdf' }), { kind: 'unreadable', reason: 'notCsv' }],
      ['an empty file', () => new File([''], 'empty.csv', { type: 'text/csv' }), { kind: 'unreadable', reason: 'empty' }],
    ])('%s', async (_name, file, error) => {
      const tool = renderTool();
      await ready(tool);
      await uploaded(tool, file());
      expect(tool.result.current.vm.statement).toMatchObject({ status: 'error', error });
      act(() => tool.result.current.vm.ticks.toggle('netflix'));
      expect(tool.result.current.vm.ticks.count).toBe(1);
      act(() => tool.result.current.vm.statement.dismissError());
      expect(tool.result.current.vm.statement).toMatchObject({ status: 'idle', error: null });
    });

    it('offline: the categorizer cannot be reached', async () => {
      const categorize = vi.fn().mockRejectedValue(new ApiError('Network error', 0));
      const tool = renderTool({ categorize });
      await ready(tool);
      await uploaded(tool);
      expect(tool.result.current.vm.statement).toMatchObject({ status: 'error', error: { kind: 'network' } });
      expect(tool.result.current.store.state?.audit).toBeUndefined();
    });
  });

  it('keeps no statement line: the saved state holds findings, never the file or its lines', async () => {
    const tool = renderTool();
    await ready(tool);
    await uploaded(tool);
    const saved = JSON.stringify(tool.result.current.store.saves);
    expect(SubscriptionsToolStateSchema.safeParse(tool.result.current.store.state).success).toBe(true);
    // Lines of the sample that are not subscriptions, and what the masker removes, are nowhere in it.
    expect(saved).not.toMatch(/Tom Becker|Maria Lopez|WHATABURGER|STARBUCKS|PAYROLL|Zelle|7339\.80|DEBIT_CARD/i);
    expect(tool.result.current.store.state!.audit!.findings.map((f) => f.id)).toEqual(subscriptionsExpected.findings.map((f) => f.id));
  });

  it('a saved audit is there on the next visit, with its choices', async () => {
    const first = renderTool();
    await ready(first);
    await uploaded(first);
    act(() => first.result.current.vm.findings.dismiss('apple-com-bill-ca'));
    const saved = first.result.current.store.state!;
    const again = renderTool({ initial: saved });
    await ready(again);
    expect(again.result.current.vm.step).toBe('findings');
    expect(again.result.current.vm.findings).toMatchObject({ found: 4, dismissedCount: 1, monthly: 66.55 }); // 69.54 − 2.99
  });

  it('a new statement replaces the findings and keeps only the choices that still apply', async () => {
    const tool = renderTool();
    await ready(tool);
    await uploaded(tool);
    act(() => tool.result.current.vm.plan.markCancel('netflix-com-ca'));
    act(() => tool.result.current.vm.findings.dismiss('apple-com-bill-ca'));
    await uploaded(tool, csvFile(['2026-10-07,NETFLIX.COM # CA,-17.99', '2026-11-07,NETFLIX.COM # CA,-17.99']));
    // The Apple choice is dropped (it is not in the new audit); the Netflix mark stays (same finding id).
    expect(tool.result.current.store.state).toMatchObject({ dismissed: [], cancelMarked: ['netflix-com-ca'] });
    expect(tool.result.current.vm.findings.active.map((f) => f.serviceId)).toEqual(['netflix']);
  });
});

describe('marks when a statement is read', () => {
  it('a mark on a ticked service points at the statement finding of the same service', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'premium')); // $24.99 ticked
    act(() => tool.result.current.vm.plan.markCancel('tick:netflix'));
    expect(tool.result.current.vm.plan.saving).toMatchObject({ monthly: 24.99 });
    await uploaded(tool);
    // The statement says $17.99, and the mark points at that finding now. It stays the tick's mark, so a later
    // statement without Netflix does not lose it.
    expect(tool.result.current.store.state!.cancelMarked).toEqual(['tick:netflix']);
    expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 1, saving: { monthly: 17.99, yearly: 215.88 } });
    expect(tool.result.current.vm.plan.options.find((o) => o.id === 'netflix-com-ca')!.markedCancel).toBe(true);
  });

  it('a mark on a ticked service the statement did not show stays', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.ticks.toggle('disney-plus')); // $7.99
    act(() => tool.result.current.vm.plan.markCancel('tick:disney-plus'));
    await uploaded(tool);
    expect(tool.result.current.store.state!.cancelMarked).toEqual(['tick:disney-plus']);
    expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 1, saving: { monthly: 7.99 } });
  });

  it('keeps the marks of statement findings that are still there, and never leaves an orphan id', async () => {
    const first = renderTool();
    await ready(first);
    await uploaded(first);
    const audited = first.result.current.store.state!;
    const tool = renderTool({
      initial: {
        ...audited,
        ticks: [{ serviceId: 'netflix', planId: 'standard' }],
        // A mark for a tick that is gone (never ticked), one for a finding of the old audit, one for Netflix's tick.
        cancelMarked: ['tick:gone', 'apple-com-bill-ca', 'tick:netflix'],
      },
    });
    await ready(tool);
    await uploaded(tool, csvFile(['2026-10-07,NETFLIX.COM # CA,-17.99', '2026-11-07,NETFLIX.COM # CA,-17.99']));
    // Apple is not in the new audit and 'tick:gone' was never a service: both are dropped. Netflix's mark stays, on its finding.
    expect(tool.result.current.store.state!.cancelMarked).toEqual(['tick:netflix']);
    expect(tool.result.current.vm.plan.options.filter((o) => o.markedCancel).map((o) => o.id)).toEqual(['netflix-com-ca']);
  });
});

describe('a mark on a ticked service follows the service, and only while it counts', () => {
  // Two Netflix lines (two merchants of one service), three months each: $17.99 and $24.99.
  const twoNetflix = (second = 24.99) => csvFile([
    '2026-09-07,NETFLIX.COM,-17.99', '2026-10-07,NETFLIX.COM,-17.99', '2026-11-07,NETFLIX.COM,-17.99',
    `2026-09-09,NETFLIX COM CA,-${second}`, `2026-10-09,NETFLIX COM CA,-${second}`, `2026-11-09,NETFLIX COM CA,-${second}`,
  ]);
  const tickAndMarkNetflix = async (tool: Tool, planId = 'standard') => {
    act(() => tool.result.current.vm.ticks.toggle('netflix', planId));
    act(() => tool.result.current.vm.plan.markCancel('tick:netflix'));
  };
  const markedIds = (tool: Tool) => tool.result.current.vm.plan.options.filter((o) => o.markedCancel).map((o) => o.id);

  it('goes to the finding that matches the ticked plan, not the costliest one: Standard $17.99, not $24.99', async () => {
    const tool = renderTool();
    await ready(tool);
    await tickAndMarkNetflix(tool);
    await uploaded(tool, twoNetflix());
    expect(tool.result.current.vm.findings.active.map((f) => [f.id, f.monthly])).toEqual([['netflix-com-ca', 24.99], ['netflix-com', 17.99]]);
    expect(markedIds(tool)).toEqual(['netflix-com']);
    expect(tool.result.current.vm.plan.saving).toMatchObject({ monthly: 17.99, yearly: 215.88 });
  });

  it('with the other plan ticked it is the other finding: Premium $24.99', async () => {
    const tool = renderTool();
    await ready(tool);
    await tickAndMarkNetflix(tool, 'premium');
    await uploaded(tool, twoNetflix());
    expect(markedIds(tool)).toEqual(['netflix-com-ca']);
    expect(tool.result.current.vm.plan.saving).toMatchObject({ monthly: 24.99 });
  });

  it('a tie is not guessed: two findings at the ticked price leave the mark on nothing, and it is dropped', async () => {
    const tool = renderTool();
    await ready(tool);
    await tickAndMarkNetflix(tool);
    await uploaded(tool, twoNetflix(17.99));
    expect(markedIds(tool)).toEqual([]);
    expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
    expect(tool.result.current.store.state!.cancelMarked).toEqual([]);
  });

  it('no finding at the ticked price among several is not guessed either', async () => {
    const tool = renderTool();
    await ready(tool);
    await tickAndMarkNetflix(tool); // $17.99 ticked; the statement has $15.49 and $24.99
    await uploaded(tool, csvFile([
      '2026-09-07,NETFLIX.COM,-15.49', '2026-10-07,NETFLIX.COM,-15.49', '2026-11-07,NETFLIX.COM,-15.49',
      '2026-09-09,NETFLIX COM CA,-24.99', '2026-10-09,NETFLIX COM CA,-24.99', '2026-11-09,NETFLIX COM CA,-24.99',
    ]));
    expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
  });

  it('the only finding of the service takes the mark, whatever its price (the statement wins)', async () => {
    const tool = renderTool();
    await ready(tool);
    await tickAndMarkNetflix(tool, 'premium'); // $24.99 ticked
    await uploaded(tool, csvFile(['2026-10-07,NETFLIX.COM,-17.99', '2026-11-07,NETFLIX.COM,-17.99']));
    expect(markedIds(tool)).toEqual(['netflix-com']);
    expect(tool.result.current.vm.plan.saving).toMatchObject({ monthly: 17.99 });
  });

  describe('replacing the statement never loses the mark of a service that is still ticked', () => {
    const spotifyOnly = () => csvFile(['2026-10-05,SPOTIFY USA,-11.99', '2026-11-05,SPOTIFY USA,-11.99']);

    it('statement A with Netflix, then statement B without it: marked on the tick again', async () => {
      const tool = renderTool();
      await ready(tool);
      await tickAndMarkNetflix(tool);
      await uploaded(tool);
      expect(markedIds(tool)).toEqual(['netflix-com-ca']);
      await uploaded(tool, spotifyOnly());
      expect(markedIds(tool)).toEqual(['tick:netflix']);
      expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 1, saving: { monthly: 17.99, isEstimate: true } });
    });

    it('statement B without Netflix, then statement A with it: marked on the finding', async () => {
      const tool = renderTool();
      await ready(tool);
      await tickAndMarkNetflix(tool);
      await uploaded(tool, spotifyOnly());
      expect(markedIds(tool)).toEqual(['tick:netflix']);
      await uploaded(tool);
      expect(markedIds(tool)).toEqual(['netflix-com-ca']);
      expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 1, saving: { monthly: 17.99, isEstimate: false } });
    });

    it('unticking the service drops its mark, whichever statement is read', async () => {
      const tool = renderTool();
      await ready(tool);
      await tickAndMarkNetflix(tool);
      await uploaded(tool);
      act(() => tool.result.current.vm.ticks.toggle('netflix', 'standard')); // off
      await uploaded(tool, spotifyOnly());
      expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
      expect(tool.result.current.store.state!.cancelMarked).toEqual([]);
    });
  });

  describe('a mark exists only while what it points at counts: no hidden mark to come back', () => {
    const stoppedNetflix = () => csvFile([
      '2026-07-07,NETFLIX.COM,-17.99', '2026-08-07,NETFLIX.COM,-17.99', '2026-09-07,NETFLIX.COM,-17.99', '2026-11-14,SOME SHOP,-3.00',
    ]);
    const activeNetflix = () => csvFile(['2026-10-07,NETFLIX.COM,-17.99', '2026-11-07,NETFLIX.COM,-17.99']);

    it('a mark carried to a stopped finding is dropped with it, and a later statement where it is active again does not revive it', async () => {
      const tool = renderTool();
      await ready(tool);
      await tickAndMarkNetflix(tool);
      await uploaded(tool, stoppedNetflix());
      expect(tool.result.current.vm.findings.stopped.map((f) => f.serviceId)).toEqual(['netflix']);
      expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
      expect(tool.result.current.store.state!.cancelMarked).toEqual([]);
      await uploaded(tool, activeNetflix());
      expect(tool.result.current.vm.findings.active.map((f) => f.serviceId)).toEqual(['netflix']);
      expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
      expect(markedIds(tool)).toEqual([]);
    });

    it('a mark on a statement finding is dropped when a new statement shows it stopped, and not revived either', async () => {
      const tool = renderTool();
      await ready(tool);
      await uploaded(tool, activeNetflix());
      act(() => tool.result.current.vm.plan.markCancel('netflix-com'));
      await uploaded(tool, stoppedNetflix());
      expect(tool.result.current.store.state!.cancelMarked).toEqual([]);
      await uploaded(tool, activeNetflix());
      expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
    });

    it('dismissing a finding takes the mark with it, a mark made through the tick included, and bringing it back does not revive it', async () => {
      const tool = renderTool();
      await ready(tool);
      await tickAndMarkNetflix(tool);
      await uploaded(tool);
      expect(markedIds(tool)).toEqual(['netflix-com-ca']);
      act(() => tool.result.current.vm.findings.dismiss('netflix-com-ca'));
      expect(tool.result.current.store.state!.cancelMarked).toEqual([]);
      expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
      act(() => tool.result.current.vm.findings.restoreDismissed());
      expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
      expect(markedIds(tool)).toEqual([]);
    });

    it('a mark can be taken off from the finding it points at, even when it was made through the tick', async () => {
      const tool = renderTool();
      await ready(tool);
      await tickAndMarkNetflix(tool);
      await uploaded(tool);
      act(() => tool.result.current.vm.plan.unmarkCancel('netflix-com-ca'));
      expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
      expect(tool.result.current.store.state!.cancelMarked).toEqual([]);
    });
  });
});

describe('apply to the profile ("Use this in my plan")', () => {
  it('a statement total is measured: $69.54 on the subscriptions line, and the detected flag is on', async () => {
    const tool = renderTool();
    await ready(tool);
    await uploaded(tool);
    expect(tool.result.current.vm.apply).toMatchObject({ canApply: true, inPlan: false, from: { value: 85, isEstimate: false }, to: { value: 69.54, isEstimate: false } });
    expect(useAppStore.getState().subscriptionsDetected).toBe(false);
    act(() => tool.result.current.vm.apply.applyToProfile());
    const s = useAppStore.getState();
    expect(s.profile.spending.subscriptions).toEqual({ value: 69.54, isEstimate: false });
    expect(s.subscriptionsDetected).toBe(true);
    expect(tool.result.current.vm.apply.inPlan).toBe(true);
    expect(tool.result.current.vm.apply.from).toEqual({ value: 69.54, isEstimate: false });
  });

  it('ticks only: $54.97 as an estimate, still a plan', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'standard'));
    act(() => tool.result.current.vm.ticks.toggle('spotify', 'individual'));
    act(() => tool.result.current.vm.ticks.toggle('planet-fitness'));
    expect(tool.result.current.vm.apply).toMatchObject({ canApply: true, to: { value: 54.97, isEstimate: true } });
    act(() => tool.result.current.vm.apply.applyToProfile());
    expect(useAppStore.getState().profile.spending.subscriptions).toEqual({ value: 54.97, isEstimate: true });
    expect(useAppStore.getState().subscriptionsDetected).toBe(true);
  });

  it('a statement with a ticked service that is not in it is an estimate: only statement findings are measured', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.ticks.toggle('disney-plus'));
    await uploaded(tool);
    act(() => tool.result.current.vm.apply.applyToProfile());
    expect(useAppStore.getState().profile.spending.subscriptions).toEqual({ value: 77.53, isEstimate: true });
  });

  it('does nothing when there is nothing to apply, and never on its own', async () => {
    const tool = renderTool();
    await ready(tool);
    expect(tool.result.current.vm.apply.canApply).toBe(false);
    act(() => tool.result.current.vm.apply.applyToProfile());
    expect(useAppStore.getState().subscriptionsDetected).toBe(false);
    expect(useAppStore.getState().profile.spending.subscriptions).toEqual({ value: 85, isEstimate: false });
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'standard'));
    await uploaded(tool);
    expect(useAppStore.getState().profile.spending.subscriptions.value).toBe(85); // reading a statement changes no profile
  });
});

describe('cancel plan', () => {
  const markTwo = async (tool: Tool) => {
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'standard'));
    act(() => tool.result.current.vm.ticks.toggle('spotify', 'individual'));
    act(() => tool.result.current.vm.plan.markCancel('tick:netflix'));
    act(() => tool.result.current.vm.plan.markCancel('tick:spotify'));
  };
  /** What S10 does for one candidate: the forecast with the patch minus the forecast without, 10 years, today's dollars. */
  const rulesEffectOf = (profile = useAppStore.getState().profile) => {
    const opts = { todaysDollars: true, rates: areaRates(profile) };
    const base = forecast(profile, 10, opts).in10y.mid;
    return rankCandidates(profile, [cancelCandidate(profile, 29.98)], (c) => forecast(applyPatch(profile, c.patch), 10, opts).in10y.mid - base)[0]!.effect10y;
  };

  it('nothing marked: no saving, no effect', async () => {
    const tool = renderTool();
    await ready(tool);
    expect(tool.result.current.vm.plan).toMatchObject({ options: [], markedCount: 0, saving: null, candidate: null, moveAdded: false });
    expect(tool.result.current.cancel).toMatchObject({ effect: null, canAddAsMove: false });
  });

  it('marking sums what is marked: $17.99 + $11.99 = $29.98 a month, $359.76 a year', async () => {
    const tool = renderTool();
    await ready(tool);
    await markTwo(tool);
    expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 2, saving: { monthly: 29.98, yearly: 359.76 } });
    act(() => tool.result.current.vm.plan.unmarkCancel('tick:spotify'));
    expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 1, saving: { monthly: 17.99, yearly: 215.88 } });
    expect(tool.result.current.vm.plan.options.find((o) => o.id === 'tick:netflix')!.markedCancel).toBe(true);
    expect(tool.result.current.vm.plan.options.find((o) => o.id === 'tick:spotify')!.markedCancel).toBe(false);
  });

  describe('the saving is an estimate wherever a marked line is one', () => {
    it('a ticked service is a catalogue price: estimate', async () => {
      const tool = renderTool();
      await ready(tool);
      act(() => tool.result.current.vm.ticks.toggle('spotify', 'individual'));
      act(() => tool.result.current.vm.plan.markCancel('tick:spotify'));
      expect(tool.result.current.vm.plan.saving).toEqual({ monthly: 11.99, yearly: 143.88, isEstimate: true });
    });

    it('a charge seen again and again in the statement is measured: no tag', async () => {
      const tool = renderTool();
      await ready(tool);
      await uploaded(tool);
      act(() => tool.result.current.vm.plan.markCancel('planet-fitness-club-fees'));
      expect(tool.result.current.vm.plan.saving).toEqual({ monthly: 24.99, yearly: 299.88, isEstimate: false });
    });

    it('a charge seen once is medium confidence: estimate; so is any estimate among the marked', async () => {
      const tool = renderTool();
      await ready(tool);
      await uploaded(tool);
      act(() => tool.result.current.vm.plan.markCancel('amazon-prime-amzn-com-bill-wa')); // $139 a year, seen once
      expect(tool.result.current.vm.plan.saving).toMatchObject({ monthly: 11.58, isEstimate: true });
      act(() => tool.result.current.vm.plan.unmarkCancel('amazon-prime-amzn-com-bill-wa'));
      act(() => tool.result.current.vm.plan.markCancel('netflix-com-ca'));
      expect(tool.result.current.vm.plan.saving).toMatchObject({ isEstimate: false });
      act(() => tool.result.current.vm.plan.markCancel('amazon-prime-amzn-com-bill-wa'));
      expect(tool.result.current.vm.plan.saving).toMatchObject({ isEstimate: true });
    });
  });

  it('only what counts can be marked: not a stopped service, a finding to confirm, or an unknown id', async () => {
    const tool = renderTool();
    await ready(tool);
    await uploaded(tool, csvFile([
      '2026-07-07,NETFLIX.COM,-17.99', '2026-08-07,NETFLIX.COM,-17.99', '2026-09-07,NETFLIX.COM,-17.99', '2026-11-14,SOME SHOP,-3.00',
    ]));
    act(() => tool.result.current.vm.plan.markCancel('netflix-com'));      // stopped
    act(() => tool.result.current.vm.plan.markCancel('no-such-finding'));
    expect(tool.result.current.store.state!.cancelMarked).toEqual([]);
  });

  it('dismissing a marked finding takes it out of the plan', async () => {
    const tool = renderTool();
    await ready(tool);
    await uploaded(tool);
    act(() => tool.result.current.vm.plan.markCancel('apple-com-bill-ca'));
    expect(tool.result.current.vm.plan.saving).toEqual({ monthly: 2.99, yearly: 35.88, isEstimate: false }); // seen five times, high confidence
    act(() => tool.result.current.vm.findings.dismiss('apple-com-bill-ca'));
    expect(tool.result.current.vm.plan).toMatchObject({ markedCount: 0, saving: null });
  });

  it('the 10-year effect is the same measurement as Next Moves: the rules forecast for the candidate, today’s dollars', async () => {
    const tool = renderTool();
    await ready(tool);
    await markTwo(tool);
    await waitFor(() => expect(tool.result.current.cancel.effect).toMatchObject({ status: 'ready' }));
    const effect = tool.result.current.cancel.effect;
    if (effect?.status !== 'ready') throw new Error('not ready');
    expect(effect.data.source).toBe('rules');
    expect(effect.data.effect10y).toBeCloseTo(rulesEffectOf(), 6);
    // $29.98 a month for 120 months is $3,598 before growth; with growth, in today's dollars, it is a few thousand more or less.
    expect(effect.data.effect10y).toBeGreaterThan(3_000);
    expect(effect.data.effect10y).toBeLessThan(6_000);
  });

  it('with the AI forecast it is the model’s scenario, deflated like S10: 20,000 nominal ÷ (1 + inflation)^10', async () => {
    mockForecastRoute((body) => aiAnswer(body, { effects: { [CANCEL_MOVE_ID]: 20_000 } }));
    const tool = renderTool();
    await ready(tool);
    await markTwo(tool);
    await waitFor(() => expect(tool.result.current.cancel.effect).toMatchObject({ status: 'ready', data: { source: 'ai' } }));
    const effect = tool.result.current.cancel.effect;
    if (effect?.status !== 'ready') throw new Error('not ready');
    const inflation = areaRates(useAppStore.getState().profile).inflationAnnual!;
    expect(effect.data.effect10y).toBeCloseTo(20_000 / (1 + inflation) ** 10, 4);
  });

  it('asks the forecast for one scenario, the candidate, with its patch: subscriptions $85 − $29.98 = $55.02', async () => {
    const route = mockForecastRoute();
    const tool = renderTool();
    await ready(tool);
    await markTwo(tool);
    await waitFor(() => expect(tool.result.current.cancel.effect).toMatchObject({ status: 'ready' }));
    const asked = route.calls.at(-1) as { scenarios: { id: string; patch: unknown }[] };
    expect(asked.scenarios).toEqual([{ id: CANCEL_MOVE_ID, patch: { spending: { subscriptions: 55.02 } } }]);
  });

  it('addAsMove commits the measured move through the store, once the number is in', async () => {
    const tool = renderTool();
    await ready(tool);
    await markTwo(tool);
    await waitFor(() => expect(tool.result.current.cancel.canAddAsMove).toBe(true));
    const effect = tool.result.current.cancel.effect;
    if (effect?.status !== 'ready') throw new Error('not ready');
    act(() => tool.result.current.cancel.addAsMove());
    const s = useAppStore.getState();
    expect(s.committedMove).toEqual({
      id: CANCEL_MOVE_ID, kind: 'cancelSubscriptions', level: 1, category: 'subscriptions',
      effect10y: effect.data.effect10y, patch: { spending: { subscriptions: 55.02 } },
    });
    expect(s.profile.committedMoveId).toBe(CANCEL_MOVE_ID);
    expect(tool.result.current.vm.plan.moveAdded).toBe(true);
    expect(track).toHaveBeenCalledWith({ name: 'move_committed', props: { kind: 'cancelSubscriptions' } });
  });

  describe('the committed move follows the plan', () => {
    /** The sample statement read, Netflix and Spotify marked ($17.99 + $11.99 = $29.98), the move added: patch $85 − $29.98 = $55.02. */
    async function committed() {
      const tool = renderTool();
      await ready(tool);
      await uploaded(tool);
      act(() => tool.result.current.vm.plan.markCancel('netflix-com-ca'));
      act(() => tool.result.current.vm.plan.markCancel('spotify-usa-ny'));
      await waitFor(() => expect(tool.result.current.cancel.canAddAsMove).toBe(true));
      act(() => tool.result.current.cancel.addAsMove());
      expect(useAppStore.getState().committedMove!.patch).toEqual({ spending: { subscriptions: 55.02 } });
      expect(tool.result.current.vm.plan).toMatchObject({ moveAdded: true, moveOutdated: false });
      return tool;
    }

    it('putting the total in the plan changes the line the move lowers, so the committed move is out of date until it is added again', async () => {
      const tool = await committed();
      act(() => tool.result.current.vm.apply.applyToProfile()); // the line goes $85 → $69.54
      expect(tool.result.current.vm.plan).toMatchObject({ moveAdded: false, moveOutdated: true });
      await waitFor(() => expect(tool.result.current.cancel.canAddAsMove).toBe(true));
      act(() => tool.result.current.cancel.addAsMove());
      // 69.54 − 29.98 = 39.56
      expect(useAppStore.getState().committedMove!.patch).toEqual({ spending: { subscriptions: 39.56 } });
      expect(tool.result.current.vm.plan).toMatchObject({ moveAdded: true, moveOutdated: false });
    });

    it('marking another service after adding the move makes it out of date: $54.97 now, not $29.98', async () => {
      const tool = await committed();
      act(() => tool.result.current.vm.plan.markCancel('planet-fitness-club-fees')); // + $24.99
      expect(tool.result.current.vm.plan.saving).toMatchObject({ monthly: 54.97 });
      expect(tool.result.current.vm.plan).toMatchObject({ moveAdded: false, moveOutdated: true });
      expect(useAppStore.getState().committedMove!.patch).toEqual({ spending: { subscriptions: 55.02 } }); // still the old one
      await waitFor(() => expect(tool.result.current.cancel.canAddAsMove).toBe(true));
      act(() => tool.result.current.cancel.addAsMove());
      expect(useAppStore.getState().committedMove!.patch).toEqual({ spending: { subscriptions: 30.03 } }); // 85 − 54.97
      expect(tool.result.current.vm.plan).toMatchObject({ moveAdded: true, moveOutdated: false });
    });

    it('unmarking back to what was committed makes it current again', async () => {
      const tool = await committed();
      act(() => tool.result.current.vm.plan.markCancel('planet-fitness-club-fees'));
      act(() => tool.result.current.vm.plan.unmarkCancel('planet-fitness-club-fees'));
      expect(tool.result.current.vm.plan).toMatchObject({ moveAdded: true, moveOutdated: false });
    });

    it('another move committed (not this plan) is neither added nor out of date', async () => {
      useAppStore.getState().commitMove({ id: 'cutCategory:eatingOut', kind: 'cutCategory', level: 1, category: 'eatingOut', effect10y: 5000, patch: { spending: { eatingOut: 272 } } });
      const tool = renderTool();
      await ready(tool);
      await markTwo(tool);
      expect(tool.result.current.vm.plan).toMatchObject({ moveAdded: false, moveOutdated: false });
    });
  });

  it('the view-model alone never asks the forecast route, marks and all (the screen mounts the measurement)', async () => {
    const route = mockForecastRoute();
    const view = renderHook(() => {
      const store = useMemoryStore();
      return { vm: useSubscriptions(useAppStore((s) => s.profile), { catalogue: testCatalogue, store, track, downloadRenewals }), store };
    });
    await waitFor(() => expect(view.result.current.vm.status).toBe('ready'));
    act(() => view.result.current.vm.ticks.toggle('netflix', 'standard'));
    act(() => view.result.current.vm.plan.markCancel('tick:netflix'));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(view.result.current.vm.plan.candidate).toMatchObject({ id: CANCEL_MOVE_ID, patch: { spending: { subscriptions: 67.01 } } }); // 85 − 17.99
    expect(route.calls).toEqual([]);
  });

  it('addAsMove does nothing while the forecast is still on its way', async () => {
    mockForecastRoute(() => new Promise(() => {})); // never answers
    const tool = renderTool();
    await ready(tool);
    await markTwo(tool);
    expect(tool.result.current.cancel.effect).toEqual({ status: 'loading' });
    expect(tool.result.current.cancel.canAddAsMove).toBe(false);
    act(() => tool.result.current.cancel.addAsMove());
    expect(useAppStore.getState().committedMove).toBeNull();
  });

  it('says when the profile holds less for subscriptions than is marked; using the audit in the plan fixes it', async () => {
    useAppStore.getState().setSpending('subscriptions', 10);
    const tool = renderTool();
    await ready(tool);
    await markTwo(tool); // $29.98 marked against $10 in the profile
    expect(tool.result.current.vm.plan).toMatchObject({ profileCovers: false, profileSubscriptions: { value: 10, isEstimate: false } });
    act(() => tool.result.current.vm.apply.applyToProfile()); // the ticks, $29.98
    expect(tool.result.current.vm.plan.profileCovers).toBe(true);
    expect(tool.result.current.vm.plan.profileSubscriptions).toEqual({ value: 29.98, isEstimate: true });
  });

  it('knows when the profile is the sample one', async () => {
    const tool = renderTool();
    await ready(tool);
    expect(tool.result.current.vm.plan.isSampleProfile).toBe(true);
    act(() => useAppStore.getState().setSpending('groceries', 600));
    expect(tool.result.current.vm.plan.isSampleProfile).toBe(false);
  });
});

describe('renewals calendar', () => {
  it('has a renewal for each counted statement finding with a next date, under the friendly name', async () => {
    const tool = renderTool();
    await ready(tool);
    expect(tool.result.current.vm.renewals).toMatchObject({ count: 0, canExport: false, outcome: null });
    await uploaded(tool);
    expect(tool.result.current.vm.renewals).toMatchObject({ count: 5, canExport: true });
    act(() => tool.result.current.vm.renewals.exportCalendar());
    expect(downloadRenewals).toHaveBeenCalledTimes(1);
    const items = downloadRenewals.mock.calls[0]![0];
    expect(items.map((i) => [i.id, i.label, i.amount, i.cadence, i.next])).toEqual([
      ['planet-fitness-club-fees', 'Planet Fitness', 24.99, 'monthly', { month: '2026-12', day: 1 }],
      ['netflix-com-ca', 'Netflix', 17.99, 'monthly', { month: '2026-12', day: 7 }],
      ['spotify-usa-ny', 'Spotify', 11.99, 'monthly', { month: '2026-12', day: 12 }],
      ['amazon-prime-amzn-com-bill-wa', 'Amazon Prime', 139, 'yearly', { month: '2027-08', day: 9 }],
      ['apple-com-bill-ca', 'APPLE.COM/BILL # CA', 2.99, 'monthly', { month: '2026-12', day: 3 }],
    ]);
    expect(tool.result.current.vm.renewals.outcome).toBe('downloaded');
  });

  it('M3 and M6 agree on a month-end charge: next expected is the 30th, the calendar keeps 31 as the billing day', async () => {
    // Charged on 31 Aug, 30 Sep, 31 Oct: M3's next date for November is clamped to the 30th, and the item says it was shortened.
    const tool = renderTool();
    await ready(tool);
    await uploaded(tool, csvFile(['2026-08-31,NETFLIX.COM,-17.99', '2026-09-30,NETFLIX.COM,-17.99', '2026-10-31,NETFLIX.COM,-17.99']));
    act(() => tool.result.current.vm.renewals.exportCalendar());
    expect(downloadRenewals.mock.calls[0]![0]).toEqual([
      { id: 'netflix-com', label: 'Netflix', amount: 17.99, cadence: 'monthly', next: { month: '2026-11', day: 30 }, billingDay: 31 },
    ]);
  });

  it('leaves out ticks (no date), dismissed findings and a finding to confirm until it is confirmed', async () => {
    const tool = renderTool({ categorize: fakeCategorize((items) => [...new Set(items.map((i) => i.label))].map((label) => ({ label, class: 'subscriptions' as const }))) });
    await ready(tool);
    act(() => tool.result.current.vm.ticks.toggle('disney-plus'));
    await uploaded(tool, csvFile(['2026-10-05,MYSTERY APP,-4.99', '2026-11-05,MYSTERY APP,-4.99']));
    expect(tool.result.current.vm.renewals.count).toBe(0);
    act(() => tool.result.current.vm.findings.confirm('mystery-app'));
    expect(tool.result.current.vm.renewals.count).toBe(1);
    act(() => tool.result.current.vm.findings.dismiss('mystery-app'));
    expect(tool.result.current.vm.renewals.count).toBe(0);
  });
});

describe('events carry enums and counts only', () => {
  it('a whole session sends valid events with no amounts, labels or ids', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.guess.set(40));
    act(() => tool.result.current.vm.ticks.toggle('netflix', 'standard'));
    act(() => tool.result.current.vm.goTo('reveal'));
    // Netflix at $15.49 for three months, then $17.99 for two: a price rise, so a flag.
    await uploaded(tool, csvFile([
      '2026-07-07,NETFLIX.COM # CA,-15.49', '2026-08-07,NETFLIX.COM # CA,-15.49', '2026-09-07,NETFLIX.COM # CA,-15.49',
      '2026-10-07,NETFLIX.COM # CA,-17.99', '2026-11-07,NETFLIX.COM # CA,-17.99',
    ]));
    act(() => tool.result.current.vm.plan.markCancel('netflix-com-ca'));
    await waitFor(() => expect(tool.result.current.cancel.canAddAsMove).toBe(true));
    act(() => tool.result.current.cancel.addAsMove());

    const events = track.mock.calls.map(([e]) => e as ClientFunnelEvent);
    expect(events.map((e) => e.name)).toEqual([
      'tool_opened', 'subs_started', 'subs_revealed', 'subs_started', 'subs_flagged', 'subs_cancel_marked', 'move_committed',
    ]);
    expect(events).toEqual([
      { name: 'tool_opened', props: { tool: 'subscriptions' } },
      { name: 'subs_started', props: { path: 'tickList' } },
      { name: 'subs_revealed', props: { miss: 'over2' } },          // 40 ÷ 17.99 = 2.22
      { name: 'subs_started', props: { path: 'statement' } },
      { name: 'subs_flagged', props: { count: 1 } },
      { name: 'subs_cancel_marked', props: { count: 1 } },
      { name: 'move_committed', props: { kind: 'cancelSubscriptions' } },
    ]);
    for (const event of events) {
      expect(ClientEventEnvelopeSchema.safeParse({ ...event, id: crypto.randomUUID() }).success, event.name).toBe(true);
    }
    const sent = JSON.stringify(events);
    expect(sent).not.toMatch(/netflix|tick:|17\.99|15\.49|\d+\.\d\d|"label"/i);
  });
});

describe('a store that refuses a save', () => {
  it('changes nothing: the next action builds on the state that was kept', async () => {
    const save = vi.fn<(next: SubscriptionsToolState) => void>().mockImplementationOnce(() => {
      throw new RangeError('refused');
    });
    const view = renderHook(() =>
      useSubscriptions(useAppStore((s) => s.profile), {
        catalogue: testCatalogue, track, downloadRenewals, categorize: fakeCategorize(),
        store: { state: undefined, save, clear: vi.fn() },
      }));
    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    expect(() => act(() => view.result.current.ticks.toggle('netflix', 'standard'))).toThrow('refused');
    act(() => view.result.current.ticks.toggle('spotify', 'individual'));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![0].ticks).toEqual([{ serviceId: 'spotify', planId: 'individual' }]); // Netflix was never kept
  });
});

describe('what stays in this browser', () => {
  it('clearLocalData forgets everything the tool kept', async () => {
    const tool = renderTool();
    await ready(tool);
    act(() => tool.result.current.vm.guess.set(40));
    act(() => tool.result.current.vm.ticks.toggle('netflix'));
    await uploaded(tool);
    expect(tool.result.current.vm.hasLocalData).toBe(true);
    act(() => tool.result.current.vm.clearLocalData());
    const { vm, store } = tool.result.current;
    expect(store.state).toBeUndefined();
    expect(vm).toMatchObject({ hasLocalData: false, step: 'guess', guess: { value: null }, ticks: { count: 0 }, findings: { found: 0 }, statement: { status: 'idle', monthsCovered: 0 } });
  });
});
