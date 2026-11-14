import type * as Engine from '@lifeguessr/engine';
import { rulesBundle, simulate } from '@lifeguessr/engine';
import { ForecastBundleSchema, type Profile } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { forecastModel, type LlmClient } from './client';
import {
  FORECAST_CALL_TIMEOUT_MS, FORECAST_DEADLINE_MS, FORECAST_MIN_RETRY_MS, PROMPT_FINGERPRINT, PROMPT_VERSION,
  EVENTS_FACT_LINE, forecastOutputFormat, forecastPrompt, forecastWithModel, promptFingerprint,
} from './forecast';
import { type ForecastRequest } from './schemas';
import { DEMO_SCENARIOS, goodAnswer, goodReply, forecastReply, reply, toWire, type WireForecast } from './testUtils';

const { create, checks } = vi.hoisted(() => ({ create: vi.fn(), checks: { throws: false } }));
const client = { messages: { create } } as unknown as LlmClient;

// The engine is real, except that a test can make the sanity check throw (it never does for a
// request that passed the schema: this is the "a check blew up" path).
vi.mock('@lifeguessr/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof Engine>();
  return {
    ...actual,
    forecastSanityIssues: (...args: Parameters<typeof actual.forecastSanityIssues>) => {
      if (checks.throws) throw new RangeError('the reference forecast has a non-finite value');
      return actual.forecastSanityIssues(...args);
    },
  };
});

// ----- fixtures: model answers built from the rules forecast, so they pass the checks ---------

const SCENARIOS = DEMO_SCENARIOS;

const request = (over: Partial<ForecastRequest> = {}): ForecastRequest => ({
  profile: cloneProfileDemo(),
  scenarios: SCENARIOS,
  ...over,
});

const scaled = (forecasts: WireForecast[], k: number): WireForecast[] =>
  forecasts.map((f) => ({
    ...f,
    anchors: f.anchors.map((a) => ({ ...a, low: a.low * k, mid: a.mid * k, high: a.high * k })),
  }));

// A failed attempt logs one diagnostic line (see `warnFailed`); the tests read it and keep the output clean.
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const logged = () => warn.mock.calls.map((call) => call.join(' ')).join('\n');

const sent = (call: number) => create.mock.calls[call]![0].messages[0].content as string;
const options = (call: number) => create.mock.calls[call]![1] as { timeout: number; maxRetries: number; signal: AbortSignal };

beforeEach(() => {
  create.mockReset();
  warn.mockClear();
  checks.throws = false;
  vi.stubEnv('ANTHROPIC_MODEL', '');
  vi.stubEnv('ANTHROPIC_FORECAST_MODEL', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// ----- forecastWithModel ----------------------------------------------------------------------

describe('forecastWithModel', () => {
  it('without a client returns the rules bundle and calls nothing', async () => {
    const req = request({ rates: { inflationAnnual: 0.04 } });
    const bundle = await forecastWithModel(req, null);
    expect(bundle).toEqual(rulesBundle(req.profile, req.scenarios, req.rates));
    expect(bundle.source).toBe('rules');
    expect(bundle).not.toHaveProperty('model');
    expect(create).not.toHaveBeenCalled();
  });

  it('turns a valid answer into an AI bundle: 121 monthly points, month 0 exact, nominal dollars', async () => {
    const req = request();
    create.mockResolvedValueOnce(goodReply(req));
    const bundle = await forecastWithModel(req, client);

    expect(bundle.source).toBe('ai');
    expect(bundle.model).toBe('claude-haiku-5-5');
    expect(Object.keys(bundle.scenarios)).toEqual(['pay-card', 'cut-eating']);
    const today = simulate(req.profile, 0).path[0]!.netWorth;
    const rules = rulesBundle(req.profile, req.scenarios);
    for (const f of [bundle.base, ...Object.values(bundle.scenarios)]) {
      expect(f.points).toHaveLength(121);
      expect(f.todaysDollars).toBe(false);
      expect(f.points[0]).toEqual({ month: 0, mid: today, low: today, high: today });
      expect(f.in10y).toBe(f.points[120]);
    }
    // Year-end points are the model's anchors exactly.
    expect(bundle.base.points[12]!.mid).toBeCloseTo(rules.base.points[12]!.mid, 6);
    expect(bundle.scenarios['pay-card']!.in10y.mid).toBeCloseTo(rules.scenarios['pay-card']!.in10y.mid, 6);
    expect(ForecastBundleSchema.safeParse(bundle).success).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('answers a request with no scenarios from the base forecast alone', async () => {
    const req = request({ scenarios: [] });
    create.mockResolvedValueOnce(goodReply(req));
    const bundle = await forecastWithModel(req, client);
    expect(bundle.source).toBe('ai');
    expect(bundle.scenarios).toEqual({});
  });

  it('calls the model with effort only: no sampling parameters, no SDK retry, a timeout and a signal', async () => {
    const req = request();
    create.mockResolvedValueOnce(goodReply(req));
    await forecastWithModel(req, client);

    const params = create.mock.calls[0]![0];
    expect(params.model).toBe('claude-haiku-5-5');
    expect(params.max_tokens).toBe(8_192);
    expect(params.output_config.effort).toBe('low');
    expect(params.output_config.format.type).toBe('json_schema');
    for (const name of ['temperature', 'top_p', 'top_k', 'thinking']) expect(params).not.toHaveProperty(name);
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0].role).toBe('user');

    const opts = options(0);
    expect(opts.maxRetries).toBe(0);
    expect(opts.timeout).toBe(FORECAST_CALL_TIMEOUT_MS);
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    expect(opts.signal.aborted).toBe(false);
  });

  it('uses the forecast model when one is configured, else the shared model', async () => {
    const req = request();
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-sonnet-5-5');
    create.mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).model).toBe('claude-sonnet-5-5');
    expect(create.mock.calls[0]![0].model).toBe('claude-sonnet-5-5');

    vi.stubEnv('ANTHROPIC_FORECAST_MODEL', 'claude-opus-5');
    create.mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).model).toBe('claude-opus-5');
    expect(create.mock.calls[1]![0].model).toBe('claude-opus-5');
  });

  it('retries once when every value is in thousands, and puts the issues in the second prompt', async () => {
    const req = request();
    create
      .mockResolvedValueOnce(forecastReply(scaled(goodAnswer(req), 1 / 1000)))
      .mockResolvedValueOnce(goodReply(req));
    const bundle = await forecastWithModel(req, client);

    expect(bundle.source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(2);
    expect(sent(1)).toContain('plausible lower bound');
    expect(sent(1)).toContain('base forecast: year 10');
    expect(sent(1)).toContain('Your previous answer was');
    expect(sent(1).startsWith(sent(0))).toBe(true);
  });

  it('retries when a scenario ends where the base ends (a move with no effect)', async () => {
    const req = request();
    const answer = goodAnswer(req);
    const flat = answer.map((f) => (f.id === 'pay-card' ? { ...f, anchors: answer[0]!.anchors } : f));
    create.mockResolvedValueOnce(forecastReply(flat)).mockResolvedValueOnce(goodReply(req));
    const bundle = await forecastWithModel(req, client);

    expect(bundle.source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(2);
    expect(sent(1)).toContain('scenario "pay-card": 10-year effect is $0');
  });

  it('retries when a scenario effect has the wrong sign or is far too big', async () => {
    const req = request();
    const answer = goodAnswer(req);
    const shift = (id: string, by: number) =>
      answer.map((f) => (f.id === id
        ? { ...f, anchors: f.anchors.map((a) => ({ ...a, low: a.low + by, mid: a.mid + by, high: a.high + by })) }
        : f));
    // 'cut-eating' should add ~$22.5K at year 10; this one subtracts it, then adds 10x as much.
    create.mockResolvedValueOnce(forecastReply(shift('cut-eating', -45_000))).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(sent(1)).toContain('scenario "cut-eating": 10-year effect');
    expect(sent(1)).toContain('wrong sign');

    create.mockReset();
    create.mockResolvedValueOnce(forecastReply(shift('cut-eating', 200_000))).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(sent(1)).toContain('times the plausible size');
  });

  // The model's year-10 anchor for 'cut-eating' is the rules one; its year-1 anchor moves only
  // a tenth of the way from the base to the rules scenario (inside the base envelope, so only
  // the effect check can see it).
  const shortEffectTooSmall = (req: ForecastRequest) => {
    const answer = goodAnswer(req);
    const base = answer.find((f) => f.id === 'base')!;
    return answer.map((f) => {
      if (f.id !== 'cut-eating') return f;
      const [first, ...rest] = f.anchors;
      const b = base.anchors[0]!;
      const toward = (from: number, to: number) => from + 0.1 * (to - from);
      return {
        ...f,
        anchors: [
          { ...first!, low: toward(b.low, first!.low), mid: toward(b.mid, first!.mid), high: toward(b.high, first!.high) },
          ...rest,
        ],
      };
    });
  };

  it("retries when a scenario's 1-year effect is far off although its 10-year effect is fine", async () => {
    const req = request();
    create.mockResolvedValueOnce(forecastReply(shortEffectTooSmall(req))).mockResolvedValueOnce(goodReply(req));
    const bundle = await forecastWithModel(req, client);

    expect(bundle.source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(2);
    expect(sent(1)).toContain('scenario "cut-eating": 1-year effect');
    expect(sent(1)).not.toContain('10-year effect');
  });

  it('puts a scenario that fails at 1 and 3 years in one issue line naming both years, so the cap counts scenarios', async () => {
    const req = request();
    const answer = goodAnswer(req);
    const base = answer.find((f) => f.id === 'base')!;
    // Years 1 and 3 move only a tenth of the way from the base to the rules scenario; 5 and 10 are right.
    const toward = (from: number, to: number) => from + 0.1 * (to - from);
    const bad = answer.map((f) => (f.id !== 'cut-eating' ? f : {
      ...f,
      anchors: f.anchors.map((a, i) => {
        if (i !== 0 && i !== 2) return a;
        const b = base.anchors[i]!;
        return { ...a, low: toward(b.low, a.low), mid: toward(b.mid, a.mid), high: toward(b.high, a.high) };
      }),
    }));
    create.mockResolvedValueOnce(forecastReply(bad)).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');

    const lines = sent(1).split('\n').filter((l) => l.startsWith('- scenario "cut-eating":') && l.includes('-year effect'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^- scenario "cut-eating": 3-year effect -?\$[\d,]+ .+; 1-year effect -?\$[\d,]+ .+$/);
    expect(lines[0]).not.toMatch(/(5|10)-year effect/);
  });

  it('falls back to rules when the short-horizon effect stays wrong', async () => {
    const req = request();
    const bad = forecastReply(shortEffectTooSmall(req));
    create.mockResolvedValueOnce(bad).mockResolvedValueOnce(bad);
    const bundle = await forecastWithModel(req, client);

    expect(bundle).toEqual(rulesBundle(req.profile, req.scenarios, req.rates));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('falls back to the rules bundle after two bad answers', async () => {
    const req = request();
    const bad = forecastReply(scaled(goodAnswer(req), 1 / 1000));
    create.mockResolvedValueOnce(bad).mockResolvedValueOnce(bad);
    const bundle = await forecastWithModel(req, client);

    expect(bundle).toEqual(rulesBundle(req.profile, req.scenarios, req.rates));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('falls back to rules when the provider throws, without a second call', async () => {
    const req = request();
    create.mockRejectedValue(new Error('overloaded'));
    const bundle = await forecastWithModel(req, client);
    expect(bundle).toEqual(rulesBundle(req.profile, req.scenarios));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('falls back to rules on a refusal, without a second call', async () => {
    create.mockResolvedValue(reply('', 'refusal'));
    expect((await forecastWithModel(request(), client)).source).toBe('rules');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('retries a cut-off answer (max_tokens) and tells the model', async () => {
    const req = request();
    create.mockResolvedValueOnce(reply('{"forecasts":[{"id":"base","yea', 'max_tokens')).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(2);
    expect(sent(1)).toContain('cut off');
    expect(sent(1)).not.toContain('"yea'); // the truncated text is not echoed back
  });

  it.each([
    ['text that is not JSON', () => reply('Sure! Here is the forecast.')],
    ['JSON that is not the wire shape', () => reply('{"forecast": []}')],
    ['a forecast whose years are strings', () => reply('{"forecasts":[{"id":"base","years":"lots"}]}')],
    ['the old keyed-anchor shape', () => reply('{"forecasts":[{"id":"base","anchors":[{"year":1,"low":1,"mid":2,"high":3}]}]}')],
  ])('retries %s', async (_name, first) => {
    const req = request();
    create.mockResolvedValueOnce(first()).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries when a scenario id is missing, and names it', async () => {
    const req = request();
    const answer = goodAnswer(req).filter((f) => f.id !== 'cut-eating');
    create.mockResolvedValueOnce(forecastReply(answer)).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(sent(1)).toContain('missing the forecast for id "cut-eating"');
  });

  it('retries when an id is duplicated', async () => {
    const req = request();
    const answer = goodAnswer(req);
    create.mockResolvedValueOnce(forecastReply([...answer, answer[1]!])).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(sent(1)).toContain('"pay-card" appears 2 times');
  });

  it('retries when the model renames an id (it is both missing and unknown)', async () => {
    const req = request();
    const renamed = goodAnswer(req).map((f) => (f.id === 'pay-card' ? { ...f, id: 'pay_card' } : f));
    create.mockResolvedValueOnce(forecastReply(renamed)).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(sent(1)).toContain('missing the forecast for id "pay-card"');
    expect(sent(1)).toContain('unknown id "pay_card"');
  });

  it('retries on structurally bad years: too few, an entry that is not three numbers, low above mid', async () => {
    const req = request();
    const answer = goodAnswer(req);
    const nineYears = answer.map((f) => (f.id === 'base' ? { ...f, anchors: f.anchors.slice(0, 9) } : f));
    create.mockResolvedValueOnce(forecastReply(nineYears)).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(sent(1)).toContain('base forecast: expected 10 anchors, one for each of years 1 to 10, got 9');

    create.mockReset();
    const wire = toWire(answer);
    wire.forecasts[1]!.years[2] = [wire.forecasts[1]!.years[2]![1]!, wire.forecasts[1]!.years[2]![2]!]; // [mid, high]
    create.mockResolvedValueOnce(reply(JSON.stringify(wire))).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(sent(1)).toContain('scenario "pay-card": year 3: give exactly three numbers [low, mid, high], not 2');

    create.mockReset();
    const inverted = answer.map((f) => (f.id === 'base'
      ? { ...f, anchors: f.anchors.map((a, i) => (i === 3 ? { ...a, low: a.mid + 100 } : a)) }
      : f));
    create.mockResolvedValueOnce(forecastReply(inverted)).mockResolvedValueOnce(goodReply(req));
    expect((await forecastWithModel(req, client)).source).toBe('ai');
    expect(sent(1)).toContain('year 4: low');
  });

  it('accepts a sensible answer for a profile that stays in debt (negative net worth)', async () => {
    const profile: Profile = cloneProfileDemo();
    profile.takeHomePay = { value: 3_200, isEstimate: false };
    profile.debts.push({
      id: 'personal-1', kind: 'personal', balance: 90_000, apr: 0.14, minPayment: { value: 1_100, isEstimate: false },
    });
    const req = request({ profile });
    const rules = rulesBundle(profile, req.scenarios);
    expect(rules.base.in10y.mid).toBeLessThan(0); // the premise: still negative after 10 years

    // Not the rules answer: 15% closer to zero and a $4,000 wider band, still in the envelope.
    const answer = goodAnswer(req).map((f) => ({
      ...f,
      anchors: f.anchors.map((a) => ({ ...a, mid: a.mid * 0.85, low: a.low * 0.85 - 2_000, high: a.high * 0.85 + 2_000 })),
    }));
    create.mockResolvedValueOnce(forecastReply(answer));
    const bundle = await forecastWithModel(req, client);

    expect(bundle.source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(1);
    expect(bundle.base.in10y.mid).toBeLessThan(0);
    expect(bundle.base.points[0]!.mid).toBe(simulate(profile, 0).path[0]!.netWorth);
  });

  it('counts a check that throws as a failed attempt, never an error', async () => {
    const req = request();
    checks.throws = true;
    create.mockResolvedValue(goodReply(req));
    const bundle = await forecastWithModel(req, client);

    expect(bundle).toEqual(rulesBundle(req.profile, req.scenarios));
    expect(create).toHaveBeenCalledTimes(2);
    expect(sent(1)).toContain('could not be checked');
  });

  it('reads the model once per request: both calls and the label name the same model', async () => {
    const req = request();
    vi.stubEnv('ANTHROPIC_FORECAST_MODEL', 'model-a');
    create.mockImplementationOnce(async () => {
      vi.stubEnv('ANTHROPIC_FORECAST_MODEL', 'model-b'); // the environment changes while the first call is out
      return forecastReply(scaled(goodAnswer(req), 1 / 1000));
    });
    create.mockResolvedValueOnce(goodReply(req));
    const bundle = await forecastWithModel(req, client);

    expect(bundle.source).toBe('ai');
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(['model-a', 'model-a']);
    expect(bundle.model).toBe('model-a');
  });

  it('accepts a scenario that ends where the base ends when its patch changes nothing', async () => {
    const req = request({
      scenarios: [{ id: 'empty', patch: {} }, { id: 'same-value', patch: { spending: { eatingOut: 340 } } }],
    });
    create.mockResolvedValueOnce(goodReply(req));
    const bundle = await forecastWithModel(req, client);

    expect(bundle.source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(1);
    expect(bundle.scenarios.empty!.in10y.mid).toBeCloseTo(bundle.base.in10y.mid, 6);
  });

  it('applies the request inflation to the rules fallback', async () => {
    const req = request({ rates: { inflationAnnual: 0.05 } });
    create.mockRejectedValue(new Error('down'));
    const bundle = await forecastWithModel(req, client);
    expect(bundle).toEqual(rulesBundle(req.profile, req.scenarios, { inflationAnnual: 0.05 }));
    expect(bundle.base.in10y.mid).not.toBe(rulesBundle(req.profile, req.scenarios).base.in10y.mid);
  });
});

// ----- diagnostics ----------------------------------------------------------------------------

describe('failed attempts are logged without content', () => {
  // Distinctive values of the demo profile and request, and text a provider error might echo.
  const SECRETS = ['5200', '6400', '17800', '14500', '3800', '0.2436', '193.92', 'card-1', 'auto-1', 'pay-card', 'cut-eating', 'echoed prompt'];
  const expectNoContent = () => {
    for (const secret of SECRETS) expect(logged()).not.toContain(secret);
  };

  it('logs nothing for a good answer or without a client', async () => {
    const req = request();
    create.mockResolvedValueOnce(goodReply(req));
    await forecastWithModel(req, client);
    await forecastWithModel(req, null);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a provider error as its class and HTTP status, never its message', async () => {
    class RateLimitError extends Error {
      status = 429;
    }
    create.mockRejectedValue(new RateLimitError('429 echoed prompt: takeHomePay 5200, debt card-1, scenario pay-card'));
    await forecastWithModel(request(), client);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(logged()).toBe('[ai/forecast] attempt failed: provider_error (attempt=1, error=RateLimitError, status=429)');
  });

  it('logs a provider error that is not an HTTP error without a status', async () => {
    create.mockRejectedValue(new TypeError('fetch failed: echoed prompt 5200'));
    await forecastWithModel(request(), client);
    expect(logged()).toBe('[ai/forecast] attempt failed: provider_error (attempt=1, error=TypeError)');
    expectNoContent();
  });

  it('logs a refusal by its stop reason', async () => {
    create.mockResolvedValue(reply('I cannot help. echoed prompt 5200', 'refusal'));
    await forecastWithModel(request(), client);
    expect(logged()).toBe('[ai/forecast] attempt failed: refusal (attempt=1, stop_reason=refusal)');
    expectNoContent();
  });

  it('logs one line per rejected attempt with the number of issues, not the issues', async () => {
    const req = request();
    const bad = forecastReply(scaled(goodAnswer(req), 1 / 1000));
    create.mockResolvedValueOnce(bad).mockResolvedValueOnce(bad);
    await forecastWithModel(req, client);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]![0]).toMatch(/^\[ai\/forecast\] attempt failed: rejected \(attempt=1, stop_reason=end_turn, issues=\d+\)$/);
    expect(warn.mock.calls[1]![0]).toMatch(/\(attempt=2, stop_reason=end_turn, issues=\d+\)$/);
    expect(logged()).not.toMatch(/plausible|lower bound|year \d/);
    expectNoContent();
  });

  it('logs a cut-off answer by its stop reason', async () => {
    const req = request();
    create.mockResolvedValueOnce(reply('{"forecasts":[{"id":"base"', 'max_tokens')).mockResolvedValueOnce(goodReply(req));
    await forecastWithModel(req, client);
    expect(logged()).toBe('[ai/forecast] attempt failed: rejected (attempt=1, stop_reason=max_tokens, issues=1)');
  });

  it('logs a check that threw by its error class, never its message', async () => {
    checks.throws = true;
    const req = request();
    create.mockResolvedValue(goodReply(req));
    await forecastWithModel(req, client);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(logged()).toContain('check_error (attempt=1, stop_reason=end_turn, issues=1, error=RangeError)');
    expect(logged()).not.toContain('non-finite');
    expectNoContent();
  });
});

// ----- time limits ----------------------------------------------------------------------------

describe('forecastWithModel deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('gives up on a call that never resolves, exactly at the deadline, and aborts it', async () => {
    const req = request();
    create.mockImplementation(() => new Promise(() => {}));
    let settled = false;
    const done = forecastWithModel(req, client).then((b) => {
      settled = true;
      return b;
    });

    await vi.advanceTimersByTimeAsync(FORECAST_DEADLINE_MS - 1);
    expect(settled).toBe(false);
    expect(options(0).signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const bundle = await done;
    expect(bundle).toEqual(rulesBundle(req.profile, req.scenarios));
    expect(options(0).signal.aborted).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('logs the deadline once, also when the call honors the abort and rejects', async () => {
    create.mockImplementation((_params, opts: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new Error('aborted: echoed prompt 5200')));
    }));
    const done = forecastWithModel(request(), client);
    await vi.advanceTimersByTimeAsync(FORECAST_DEADLINE_MS);
    expect((await done).source).toBe('rules');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(logged()).toBe(`[ai/forecast] attempt failed: deadline (${FORECAST_DEADLINE_MS} ms) reached`);
  });

  it('does not start a second attempt when less than the minimum retry time remains', async () => {
    const req = request();
    const bad = forecastReply(scaled(goodAnswer(req), 1 / 1000));
    const lateMs = FORECAST_DEADLINE_MS - FORECAST_MIN_RETRY_MS + 1; // 1 ms short of a retry
    create.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(bad), lateMs)));
    create.mockResolvedValue(goodReply(req)); // would succeed, if it were asked

    const done = forecastWithModel(req, client);
    await vi.advanceTimersByTimeAsync(lateMs);

    expect((await done).source).toBe('rules');
    expect(create).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts the second attempt when exactly the minimum retry time remains, with that time as its timeout', async () => {
    const req = request();
    const bad = forecastReply(scaled(goodAnswer(req), 1 / 1000));
    const lateMs = FORECAST_DEADLINE_MS - FORECAST_MIN_RETRY_MS;
    create.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(bad), lateMs)));
    create.mockResolvedValueOnce(goodReply(req));

    const done = forecastWithModel(req, client);
    await vi.advanceTimersByTimeAsync(lateMs);

    expect((await done).source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(2);
    expect(options(0).timeout).toBe(FORECAST_CALL_TIMEOUT_MS);
    expect(options(1).timeout).toBe(FORECAST_MIN_RETRY_MS);
    expect(options(1).maxRetries).toBe(0);
    expect(options(1).signal).toBeInstanceOf(AbortSignal);
  });

  it('bounds the whole request: a hung second attempt ends at the deadline too', async () => {
    const req = request();
    create.mockResolvedValueOnce(forecastReply(scaled(goodAnswer(req), 1 / 1000)));
    create.mockImplementationOnce(() => new Promise(() => {}));

    const done = forecastWithModel(req, client);
    await vi.advanceTimersByTimeAsync(FORECAST_DEADLINE_MS);

    expect((await done).source).toBe('rules');
    expect(create).toHaveBeenCalledTimes(2);
    expect(options(1).timeout).toBe(FORECAST_DEADLINE_MS); // nothing elapsed: it got the whole budget
    expect(options(1).signal.aborted).toBe(true);
  });

  it('keeps the documented budgets, sized for Claude Opus 5.5 at effort low (15–20 s per answer, measured)', () => {
    expect(FORECAST_CALL_TIMEOUT_MS).toBe(30_000);
    expect(FORECAST_DEADLINE_MS).toBe(40_000);
    expect(FORECAST_MIN_RETRY_MS).toBe(15_000);
  });

  it('sends the first call with the 30 s timeout and a retry with what is left of the 40 s deadline', async () => {
    vi.useFakeTimers();
    const req = request();
    create.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 18_000)); // a slow first answer that fails the checks
      return forecastReply(scaled(goodAnswer(req), 1 / 1000));
    }).mockResolvedValueOnce(goodReply(req));
    const done = forecastWithModel(req, client);
    await vi.advanceTimersByTimeAsync(18_000);
    expect((await done).source).toBe('ai');
    expect(options(0).timeout).toBe(30_000);
    expect(options(1).timeout).toBe(22_000);
  });
});

// ----- prompt ---------------------------------------------------------------------------------

describe('forecastPrompt', () => {
  const withIdentifiers = (): ForecastRequest => {
    const profile = cloneProfileDemo();
    profile.zip = '75206';
    profile.committedMoveId = 'payCardFirst:card-1';
    profile.doneMoveIds = ['cutCategory:eatingOut'];
    return request({ profile, rates: { inflationAnnual: 0.034 } });
  };

  it('carries the facts, estimate flags, scenario ids and patches, and the assumptions', () => {
    const { content } = forecastPrompt(withIdentifiers());
    for (const fact of ['5200', '6400', '0.2436', '193.92', '"cash"', '"retirement"']) expect(content).toContain(fact);
    expect(content).toContain('"isEstimate":true');
    expect(content).toContain('"isEstimate":false');
    expect(content).toContain('"base"');
    for (const { id, patch } of SCENARIOS) {
      expect(content).toContain(`"${id}"`);
      expect(content).toContain(JSON.stringify(patch));
    }
    expect(content).toContain('0.034'); // the area inflation from the request
    expect(content).toContain('−$5,900'); // today's net worth, as the app formats it
    expect(content).toMatch(/0\.06/); // retirement return
    expect(content).toMatch(/0\.03\b/); // cash yield
  });

  it('never carries the ZIP, the committed move or the done moves', () => {
    const { system, content } = forecastPrompt(withIdentifiers());
    for (const text of [system, content]) {
      expect(text).not.toMatch(/zip/i);
      expect(text).not.toContain('committedMoveId');
      expect(text).not.toContain('doneMoveIds');
      expect(text).not.toContain('75206');
      expect(text).not.toContain('payCardFirst:card-1');
      expect(text).not.toContain('cutCategory:eatingOut');
    }
  });

  it('asks for nominal dollars, years 1 to 10 only, low ≤ mid ≤ high, no advice and JSON only', () => {
    const { system } = forecastPrompt(request());
    expect(system).toMatch(/nominal/i);
    expect(system).toMatch(/years 1 through 10 only/i);
    expect(system).toContain('low ≤ mid ≤ high');
    expect(system).toMatch(/not financial advice/i);
    expect(system).toMatch(/JSON only/i);
    expect(system).toMatch(/isEstimate/);
    expect(system).toMatch(/exactly once/i);
  });

  it('lets a scenario equal the base only when its patch changes nothing', () => {
    const { system } = forecastPrompt(request());
    expect(system).toContain('do not copy "base" for a scenario unless its patch changes nothing');
    expect(system).not.toMatch(/never copy/i);
  });

  it('says there are no scenarios when none are given', () => {
    const { content } = forecastPrompt(request({ scenarios: [] }));
    expect(content).toMatch(/no scenarios/i);
  });

  it('is versioned so cache keys can follow it', () => {
    expect(PROMPT_VERSION).toBe(4); // 4: life events
  });

  describe('life events', () => {
    const withEvents = (): ForecastRequest => {
      const profile: Profile = {
        ...cloneProfileDemo(),
        asOf: '2026-11',
        events: [
          { id: 'ev-raise-1', kind: 'pay', month: '2027-02', preset: 'raise', takeHomePay: { value: 6_100, isEstimate: false } },
          { id: 'ev-kid-1', kind: 'spending', month: '2028-03', preset: 'kid', category: 'childcare', monthly: { value: 1_150, isEstimate: true } },
          { id: 'ev-car-1', kind: 'oneOff', month: '2027-06', preset: 'bigPurchase', amount: 9_000, direction: 'cost' },
        ],
      };
      return request({ profile });
    };

    it('explains the events in one line and shows them with startsInMonths, not ids, presets or dates', () => {
      const { content } = forecastPrompt(withEvents());
      expect(content).toContain(EVENTS_FACT_LINE);
      expect(content).toContain('{"kind":"pay","startsInMonths":3,"takeHomePay":{"value":6100,"isEstimate":false}}');
      expect(content).toContain('"category":"childcare","monthly":{"value":1150,"isEstimate":true}');
      expect(content).toContain('{"kind":"oneOff","startsInMonths":7,"amount":9000,"direction":"cost"}');
      for (const hidden of ['ev-raise-1', 'ev-kid-1', 'raise', 'bigPurchase', '2026-11', '2027-02', 'asOf', '"preset"']) {
        expect(content).not.toContain(hidden);
      }
    });

    it('leaves the line out when there are no events', () => {
      expect(forecastPrompt(request()).content).not.toContain(EVENTS_FACT_LINE);
      expect(forecastPrompt(request()).content).not.toContain('startsInMonths');
    });

    it('checks the answer against a rules forecast that includes the events', async () => {
      const req = withEvents();
      create.mockResolvedValueOnce(goodReply(req));
      const bundle = await forecastWithModel(req, client);
      expect(bundle.source).toBe('ai');
      expect(bundle.base.points[0]!.mid).toBe(simulate(req.profile, 0).path[0]!.netWorth);
      const withoutEvents = rulesBundle(request().profile, req.scenarios);
      expect(rulesBundle(req.profile, req.scenarios).base.in10y.mid).not.toBe(withoutEvents.base.in10y.mid);
    });
  });
});

describe('prompt fingerprint', () => {
  const format = () => structuredClone(forecastOutputFormat()) as { type: string; schema: Record<string, unknown> };

  it('is a sha256 hex digest of the system prompt and the output format the call sends', () => {
    expect(PROMPT_FINGERPRINT).toMatch(/^[0-9a-f]{64}$/);
    expect(PROMPT_FINGERPRINT).toBe(promptFingerprint(forecastPrompt(request()).system, forecastOutputFormat()));
  });

  it('does not depend on the request or on the order the schema keys were built in', () => {
    const { system } = forecastPrompt(request());
    expect(promptFingerprint(forecastPrompt(request({ scenarios: [] })).system, forecastOutputFormat()))
      .toBe(PROMPT_FINGERPRINT);
    const f = format();
    const reordered = { schema: Object.fromEntries(Object.entries(f.schema).reverse()), type: f.type };
    expect(promptFingerprint(system, reordered)).toBe(PROMPT_FINGERPRINT);
  });

  it('changes when the system prompt is edited', () => {
    const { system } = forecastPrompt(request());
    expect(promptFingerprint(`${system} `, forecastOutputFormat())).not.toBe(PROMPT_FINGERPRINT);
    expect(promptFingerprint(system.replace('Rules:', 'Rule:'), forecastOutputFormat())).not.toBe(PROMPT_FINGERPRINT);
  });

  it('changes when the wire schema, or a field description in it, is edited', () => {
    const { system } = forecastPrompt(request());
    const renamed = format();
    renamed.schema.description = 'a new description';
    expect(promptFingerprint(system, renamed)).not.toBe(PROMPT_FINGERPRINT);
    const text = JSON.stringify(forecastOutputFormat());
    const edited = JSON.parse(text.replace('written exactly as listed', 'spelled exactly as listed')) as typeof renamed;
    expect(text).not.toBe(JSON.stringify(edited)); // the description really is in the format
    expect(promptFingerprint(system, edited)).not.toBe(PROMPT_FINGERPRINT);
  });
});

// ----- structured output format -----------------------------------------------------------------

describe('forecast output format', () => {
  // Structured outputs need every object closed with every property required.
  const walk = (node: unknown, visit: (o: Record<string, unknown>) => void) => {
    if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
    else if (node && typeof node === 'object') {
      visit(node as Record<string, unknown>);
      Object.values(node).forEach((n) => walk(n, visit));
    }
  };

  it('has closed objects with all properties required, inline, and the expected shape', () => {
    const { type, schema } = forecastOutputFormat();
    expect(type).toBe('json_schema');
    const shapes: string[][] = [];
    walk(schema, (o) => {
      expect(o).not.toHaveProperty('$ref');
      expect(o).not.toHaveProperty('$defs');
      if (o.type === 'object' && o.properties) {
        expect(o.additionalProperties).toBe(false);
        expect([...(o.required as string[])].sort()).toEqual(Object.keys(o.properties).sort());
        shapes.push(Object.keys(o.properties).sort());
      }
    });
    expect(shapes).toEqual([['forecasts'], ['id', 'years']]);
    // years: an array of arrays of numbers (the triples)
    const years = (schema as { properties: { forecasts: { items: { properties: { years: unknown } } } } })
      .properties.forecasts.items.properties.years;
    expect(years).toMatchObject({ type: 'array', items: { type: 'array', items: { type: 'number' } } });
  });
});

describe('forecastModel', () => {
  it('prefers ANTHROPIC_FORECAST_MODEL, then ANTHROPIC_MODEL, then the default', () => {
    expect(forecastModel()).toBe('claude-haiku-5-5');
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-sonnet-5-5');
    expect(forecastModel()).toBe('claude-sonnet-5-5');
    vi.stubEnv('ANTHROPIC_FORECAST_MODEL', '  claude-opus-5 ');
    expect(forecastModel()).toBe('claude-opus-5');
    vi.stubEnv('ANTHROPIC_FORECAST_MODEL', '   ');
    expect(forecastModel()).toBe('claude-sonnet-5-5');
  });
});
