// Pro adapter for /api/pro/* (S15, the paywall demo). Every request and response goes through the
// shared zod schemas in packages/types, and nothing here throws: failures come back as a small
// typed `ProFailure` the view-model maps to copy. The server decides who is Pro; this only asks.
import {
  ProCheckoutRequestSchema,
  ProCheckoutResponseSchema,
  ProConfirmRequestSchema,
  ProDemoCheckoutRequestSchema,
  ProDemoUnlockRequestSchema,
  ProErrorResponseSchema,
  ProMutationResponseSchema,
  ProStatusResponseSchema,
  type ProErrorCode,
  type ProPlan,
  type ProStatus,
} from '@lifeguessr/types';
import type { z } from 'zod';
import { getAnonId } from '@/state/anonId';
import { ApiError, getJson, postJson } from './http';

/**
 * Why a Pro call failed.
 * - badRequest: the request broke the contract (caught here before sending, or a 400/413).
 * - rateLimited: 429; `retryAfterSeconds` when the server said how long to wait.
 * - unavailable: 503, or the route does not exist yet (404/405/501).
 * - upstream: Stripe failed or timed out (502).
 * - notPaid: confirm, the Checkout Session is not complete and paid (402).
 * - sessionMismatch: confirm, the session belongs to another anonymous id or was claimed (409).
 * - invalidCode: demo unlock, wrong code or the promo is switched off (403).
 * - network: no response, or a status this contract does not name.
 * - invalidResponse: a 2xx whose body broke the contract.
 */
export type ProFailure =
  | { kind: 'badRequest' }
  | { kind: 'rateLimited'; retryAfterSeconds: number | null }
  | { kind: 'unavailable' }
  | { kind: 'upstream' }
  | { kind: 'notPaid' }
  | { kind: 'sessionMismatch' }
  | { kind: 'invalidCode' }
  | { kind: 'network' }
  | { kind: 'invalidResponse' };

export type ProResult<T> = { ok: true; value: T } | { ok: false; error: ProFailure };

/** GET /api/pro/status without the `ok` flag. */
export type ProStatusInfo = Omit<z.output<typeof ProStatusResponseSchema>, 'ok'>;

export interface ProAdapter {
  status(): Promise<ProResult<ProStatusInfo>>;
  /** Create a test-mode Checkout Session; the value is the Stripe-hosted URL to send the browser to. */
  startCheckout(plan: ProPlan): Promise<ProResult<string>>;
  /** Claim a finished Checkout Session (`cs_test_…`) for this anonymous id. */
  confirm(sessionId: string): Promise<ProResult<ProStatus>>;
  /** Unlock with the promo code shown on the Pro screen. */
  demoUnlock(code: string): Promise<ProResult<ProStatus>>;
  /** The simulated checkout: nothing is charged and only the plan is sent. */
  demoCheckout(plan: ProPlan): Promise<ProResult<ProStatus>>;
}

const CODE_TO_FAILURE: Record<ProErrorCode, ProFailure['kind']> = {
  bad_request: 'badRequest',
  too_large: 'badRequest',
  rate_limited: 'rateLimited',
  unavailable: 'unavailable',
  upstream_error: 'upstream',
  not_paid: 'notPaid',
  session_mismatch: 'sessionMismatch',
  invalid_code: 'invalidCode',
};

// Fallback when a reply has no recognisable error body (a proxy page, a route that is not deployed).
const STATUS_TO_FAILURE: Record<number, ProFailure['kind']> = {
  400: 'badRequest',
  402: 'notPaid',
  403: 'invalidCode',
  404: 'unavailable',
  405: 'unavailable',
  409: 'sessionMismatch',
  413: 'badRequest',
  429: 'rateLimited',
  501: 'unavailable',
  502: 'upstream',
  503: 'unavailable',
};

/** Map anything a fetch helper threw to a ProFailure. */
export function toProFailure(err: unknown): ProFailure {
  if (!(err instanceof ApiError)) return { kind: 'network' };
  if (err.invalid) return { kind: 'invalidResponse' };
  const body = ProErrorResponseSchema.safeParse(err.body);
  const kind = body.success ? CODE_TO_FAILURE[body.data.error.code] : STATUS_TO_FAILURE[err.status];
  if (kind === 'rateLimited') {
    const seconds = body.success ? body.data.error.retryAfterSeconds : undefined;
    return { kind, retryAfterSeconds: seconds !== undefined && seconds > 0 ? Math.ceil(seconds) : null };
  }
  return kind ? { kind } : { kind: 'network' };
}

async function attempt<T>(call: () => Promise<T>): Promise<ProResult<T>> {
  try {
    return { ok: true, value: await call() };
  } catch (err) {
    return { ok: false, error: toProFailure(err) };
  }
}

const BAD_REQUEST: ProResult<never> = { ok: false, error: { kind: 'badRequest' } };

export function createHttpProAdapter(opts: { anonId?: () => string; base?: string } = {}): ProAdapter {
  const anonId = opts.anonId ?? getAnonId;
  const base = opts.base ?? '';
  const post = <S extends z.ZodType>(path: string, body: unknown, schema: S) =>
    attempt(() => postJson(`${base}${path}`, body, schema, { anonId: anonId() }));

  return {
    async status() {
      const res = await attempt(() => getJson(`${base}/api/pro/status`, ProStatusResponseSchema, { anonId: anonId() }));
      return res.ok ? { ok: true, value: { status: res.value.status, checkoutAvailable: res.value.checkoutAvailable, demo: res.value.demo } } : res;
    },
    async startCheckout(plan) {
      const req = ProCheckoutRequestSchema.safeParse({ plan });
      if (!req.success) return BAD_REQUEST;
      const res = await post('/api/pro/checkout', req.data, ProCheckoutResponseSchema);
      return res.ok ? { ok: true, value: res.value.url } : res;
    },
    async confirm(sessionId) {
      const req = ProConfirmRequestSchema.safeParse({ sessionId });
      if (!req.success) return BAD_REQUEST;
      const res = await post('/api/pro/confirm', req.data, ProMutationResponseSchema);
      return res.ok ? { ok: true, value: res.value.status } : res;
    },
    async demoUnlock(code) {
      const req = ProDemoUnlockRequestSchema.safeParse({ code });
      if (!req.success) return BAD_REQUEST;
      const res = await post('/api/pro/demo-unlock', req.data, ProMutationResponseSchema);
      return res.ok ? { ok: true, value: res.value.status } : res;
    },
    async demoCheckout(plan) {
      const req = ProDemoCheckoutRequestSchema.safeParse({ plan });
      if (!req.success) return BAD_REQUEST;
      const res = await post('/api/pro/demo-checkout', req.data, ProMutationResponseSchema);
      return res.ok ? { ok: true, value: res.value.status } : res;
    },
  };
}

let adapter: ProAdapter | null = null;

/** The adapter every Pro call goes through (HTTP unless a test replaced it). */
export function getProAdapter(): ProAdapter {
  adapter ??= createHttpProAdapter();
  return adapter;
}

/** Replace the adapter (tests); null goes back to HTTP on the next call. */
export function setProAdapter(next: ProAdapter | null): void {
  adapter = next;
}
