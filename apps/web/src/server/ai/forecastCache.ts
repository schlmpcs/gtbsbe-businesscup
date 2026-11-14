// Server-only: the answer cache of /api/ai/forecast (docs/ENGINEERING.md → AI forecast).
//
// The same inputs get the same forecast, so a repeat of a request does not need a second model
// call: it costs money and seconds. This holds the answers of this process in memory (production
// is one Node process, so a module-level cache is effectively global), and makes requests that
// arrive while the same answer is being computed wait for that one call instead of starting their
// own. Only `source: 'ai'` answers are kept: a rules bundle is the fallback for a failure that may
// be gone in a minute, and keeping it would pin the user to it for the whole time to live.
//
// The key is built from what the model is shown (`forecastFacts`, no ZIP and no move ids), so two
// profiles that differ only in what the model never sees share an answer, and nothing that
// identifies a person is in a key (CLAUDE.md rule 6).
import { createHash } from 'node:crypto';
import { forecastFacts, resolveRates } from '@lifeguessr/engine';
import type { ForecastBundle } from '@lifeguessr/types';
import { canonicalJson } from '@/lib/canonicalJson';
import { PROMPT_FINGERPRINT, PROMPT_VERSION } from './forecast';
import type { ForecastRequest } from './schemas';

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The cache key of a request: a sha256 hex digest of the canonical JSON of what the model is shown
 * (`forecastFacts` of the profile, the scenarios, the rates as `forecastPrompt` resolves them) with
 * the model id, `PROMPT_VERSION` and `PROMPT_FINGERPRINT` (a hash of the system prompt and the output
 * schema, so an edit to either without a version bump does not serve old answers). The scenarios are sorted by id first: the bundle is keyed by
 * id, so the order a client lists them in must not split the cache. The rates are resolved first,
 * so a request that leaves them out and one that spells out the defaults, which make the same
 * prompt, share a key.
 */
export function forecastKey(req: ForecastRequest, model: string): string {
  const scenarios = [...req.scenarios].sort(byId);
  const canonical = canonicalJson({
    facts: forecastFacts(req.profile),
    scenarios,
    rates: resolveRates(req.rates),
    model,
    promptVersion: PROMPT_VERSION,
    promptFingerprint: PROMPT_FINGERPRINT,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export type ForecastCache = {
  /**
   * The cached AI bundle for `key`, or the result of `compute`. Calls that arrive while `compute`
   * is running share its promise (a rejection reaches every one of them and is not kept). The
   * bundle is shared between callers, so it is deeply frozen: a write to it throws.
   */
  getOrCompute(key: string, compute: () => Promise<ForecastBundle>): Promise<ForecastBundle>;
  /** Forgets every stored answer and every computation in flight (their callers still get their answer; it is not stored). */
  clear(): void;
};

type Stored = { bundle: ForecastBundle; expiresAt: number };

/** Freezes `value` and everything inside it, in place. A bundle is plain data: objects, arrays, numbers and strings. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const member of Object.values(value)) deepFreeze(member);
  return value;
}

export function createForecastCache(
  opts: { max?: number; ttlMs?: number; now?: () => number } = {},
): ForecastCache {
  const { max = 500, ttlMs = 3_600_000, now = Date.now } = opts;
  // A Map iterates in insertion order: the first key is the least recently used (a hit moves its entry to the end).
  const stored = new Map<string, Stored>();
  const inFlight = new Map<string, Promise<ForecastBundle>>();
  // `clear` bumps it; a computation that began under an older one must not store its answer.
  let generation = 0;

  function store(key: string, bundle: ForecastBundle): void {
    stored.delete(key);
    stored.set(key, { bundle, expiresAt: now() + ttlMs });
    while (stored.size > max) stored.delete(stored.keys().next().value!);
  }

  return {
    getOrCompute(key, compute) {
      const hit = stored.get(key);
      if (hit) {
        stored.delete(key);
        if (now() < hit.expiresAt) {
          stored.set(key, hit); // most recently used
          return Promise.resolve(hit.bundle);
        }
      }

      const pending = inFlight.get(key);
      if (pending) return pending;

      const startedIn = generation;
      // An async function, so a `compute` that throws instead of returning a promise is a rejection too.
      const promise: Promise<ForecastBundle> = (async () => {
        // Every caller of this key gets this one object: freeze it, so none can change it for the others.
        const bundle = deepFreeze(await compute());
        if (bundle.source === 'ai' && startedIn === generation) store(key, bundle);
        return bundle;
      })().finally(() => {
        // Settled either way. After a `clear`, the entry may by now be a newer computation's.
        if (inFlight.get(key) === promise) inFlight.delete(key);
      });
      inFlight.set(key, promise);
      return promise;
    },

    clear() {
      generation += 1;
      stored.clear();
      inFlight.clear();
    },
  };
}

/** The cache the route uses: one per process. */
export const forecastCache: ForecastCache = createForecastCache();
