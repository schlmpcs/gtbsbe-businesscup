// Test helpers for the forecast route (jsdom or node tests): a stand-in for POST /api/ai/forecast,
// and bundle builders for the answers a test needs. No test reaches a live model.
import { rulesBundle } from '@lifeguessr/engine';
import type { Forecast, ForecastBundle, ForecastPoint, ProfilePatch } from '@lifeguessr/types';
import { onTestFinished, vi } from 'vitest';
import { ForecastRequestSchema } from '@/server/ai/schemas';

/** What the route handler gets: the parsed JSON body the client sent. */
type Reply = ForecastBundle | Response;
export type ForecastHandler = (body: unknown) => Reply | Promise<Reply>;

type RequestBody = { profile: Parameters<typeof rulesBundle>[0]; scenarios?: { id: string; patch: ProfilePatch }[]; rates?: { inflationAnnual: number } };

/** The rules bundle for a request body: what the real route answers with no key, and the default here. */
export function rulesAnswer(body: unknown): ForecastBundle {
  const { profile, scenarios = [], rates } = body as RequestBody;
  return rulesBundle(profile, scenarios, rates);
}

const shift = (f: Forecast, at: (p: ForecastPoint) => number): Forecast => {
  const points = f.points.map((p) => ({ ...p, mid: p.mid + at(p), low: p.low + at(p), high: p.high + at(p) }));
  return { points, in10y: points[120]!, todaysDollars: f.todaysDollars };
};

/**
 * An answer labeled 'ai' for a request body: the rules bundle with every scenario's 10-year effect
 * (against the base, nominal dollars) set by `effects` (default: the rules effect, so only the label
 * differs) and the base moved up by `baseShift` at month 120 (linearly from today). The checks the
 * server runs are not repeated here; this is just a well-formed bundle.
 */
export function aiAnswer(
  body: unknown,
  opts: { effects?: Record<string, number>; baseShift?: number } = {},
): ForecastBundle {
  const rules = rulesAnswer(body);
  const lift = (p: ForecastPoint) => ((opts.baseShift ?? 0) * p.month) / 120;
  const base = opts.baseShift ? shift(rules.base, lift) : rules.base;
  const scenarios = Object.fromEntries(
    Object.entries(rules.scenarios).map(([id, f]) => {
      const effect = opts.effects?.[id];
      if (effect === undefined) return [id, opts.baseShift ? shift(f, lift) : f];
      return [id, shift(base, (p) => (effect * p.month) / 120)];
    }),
  );
  return { source: 'ai', model: 'test-model', base, scenarios };
}

/**
 * Stub `fetch` for POST /api/ai/forecast until the test ends (other URLs go to the real fetch).
 * `handler` answers each request: a bundle (sent as 200 JSON), a Response (any status), or a promise
 * of either to hold a request open; throwing rejects the fetch like a network error. The default
 * answers with the rules bundle. A fetch honors its AbortSignal like a browser's (`ignoreAbort` for
 * a response that still arrives after the abort). Every request body must pass the real route's
 * request schema, checked when the test ends. `calls` holds the parsed bodies, `signals` their signals.
 */
export function mockForecastRoute(
  handler: ForecastHandler = rulesAnswer,
  opts: { ignoreAbort?: boolean } = {},
): { calls: unknown[]; signals: AbortSignal[] } {
  const calls: unknown[] = [];
  const signals: AbortSignal[] = [];
  const realFetch = globalThis.fetch;
  const stub = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (String(input) !== '/api/ai/forecast') return realFetch(input, init);
    const body: unknown = JSON.parse(String(init?.body));
    calls.push(body);
    const signal = init?.signal ?? undefined;
    if (signal) signals.push(signal);
    return new Promise<Response>((resolve, reject) => {
      if (signal && !opts.ignoreAbort) {
        const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
        if (signal.aborted) return abort();
        signal.addEventListener('abort', abort, { once: true });
      }
      Promise.resolve()
        .then(() => handler(body))
        .then((reply) => resolve(reply instanceof Response ? reply : Response.json(reply)), reject);
    });
  });
  vi.stubGlobal('fetch', stub);
  onTestFinished(() => {
    vi.unstubAllGlobals();
    for (const body of calls) {
      const parsed = ForecastRequestSchema.safeParse(body);
      if (!parsed.success) throw new Error(`the client sent a forecast request the route would reject: ${parsed.error.message}`);
    }
  });
  return { calls, signals };
}
