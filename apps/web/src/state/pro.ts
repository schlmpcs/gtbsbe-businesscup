// Pro status in the browser (S15). The server is the authority on who is Pro; this store keeps its
// last answer plus what the Pro screen needs (is checkout configured, the promo code). localStorage
// holds only a hint so a Pro user does not see "free" for a moment on load. The hint never
// authorizes anything on the server, and any server answer replaces it.
import { ProStatusSchema, type ProStatus } from '@lifeguessr/types';
import { useEffect } from 'react';
import { z } from 'zod';
import { create } from 'zustand';
import { getProAdapter, type ProFailure, type ProResult, type ProStatusInfo } from '@/lib/api/pro';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import { getAnonId } from './anonId';

export const PRO_CACHE_KEY = 'lifeguessr.pro';

export type ProData = {
  /** Last known status: the server's answer, else the cached hint, else free. */
  status: ProStatus;
  /** Where `status` came from. Only 'server' is an answer; 'cache' is a hint. */
  origin: 'default' | 'cache' | 'server';
  /** The GET /api/pro/status request: idle before the first one, then loading → ready or error. */
  load: 'idle' | 'loading' | 'ready' | 'error';
  /** Why the last status request failed (load 'error'). */
  error: ProFailure | null;
  /** False until the server says a Stripe test key is configured. */
  checkoutAvailable: boolean;
  demo: ProStatusInfo['demo'];
};

export type ProActions = {
  /** Fetch the status. Concurrent calls share one request; a failure keeps the last status. */
  refresh: () => Promise<void>;
  /** Claim a Stripe test Checkout Session; on success the store holds the new status. */
  confirmCheckout: (sessionId: string) => Promise<ProResult<ProStatus>>;
  /** Unlock with the promo code; on success the store holds the new status. */
  redeemCode: (code: string) => Promise<ProResult<ProStatus>>;
};

export type ProState = ProData & ProActions;

export function initialProData(): ProData {
  return { status: { pro: false }, origin: 'default', load: 'idle', error: null, checkoutAvailable: false, demo: { enabled: false } };
}

// The hint is bound to the anonymous id it was fetched for, so a reset id never inherits it.
const CacheSchema = z.object({ anonId: z.string(), status: ProStatusSchema });

function readCache(): ProStatus | null {
  try {
    const parsed = CacheSchema.safeParse(JSON.parse(readStorage(PRO_CACHE_KEY) ?? 'null'));
    return parsed.success && parsed.data.anonId === getAnonId() ? parsed.data.status : null;
  } catch {
    return null; // not JSON
  }
}

function writeCache(status: ProStatus): void {
  writeStorage(PRO_CACHE_KEY, JSON.stringify({ anonId: getAnonId(), status }));
}

// Every answer that changes the status bumps `epoch`; a status request started before the latest
// change is dropped when it lands, so a slow "free" reply cannot undo a fresh unlock.
let epoch = 0;
let inflight: { epoch: number; promise: Promise<void> } | null = null;

// The adapter contract is "never throws"; this keeps a broken replacement from wedging the store.
const NETWORK: ProResult<never> = { ok: false, error: { kind: 'network' } };
async function safely<T>(call: () => Promise<ProResult<T>>): Promise<ProResult<T>> {
  try {
    return await call();
  } catch {
    return NETWORK;
  }
}

export const useProStore = create<ProState>()((set, get) => {
  const settle = (status: ProStatus) => {
    epoch += 1;
    writeCache(status);
    set({ status, origin: 'server' });
  };

  const mutate = async (call: () => Promise<ProResult<ProStatus>>): Promise<ProResult<ProStatus>> => {
    const res = await safely(call);
    if (res.ok) {
      settle(res.value);
      void get().refresh(); // checkout availability and the promo info may have changed too
    }
    return res;
  };

  return {
    ...initialProData(),
    refresh: () => {
      if (inflight?.epoch === epoch) return inflight.promise;
      const started = epoch;
      set({ load: 'loading' });
      const promise = safely(() => getProAdapter().status())
        .then((res) => {
          if (started !== epoch) return;
          if (res.ok) {
            writeCache(res.value.status);
            set({ ...res.value, origin: 'server', load: 'ready', error: null });
          } else {
            set({ load: 'error', error: res.error });
          }
        })
        .finally(() => {
          if (inflight?.promise === promise) inflight = null;
        });
      inflight = { epoch: started, promise };
      return promise;
    },
    confirmCheckout: (sessionId) => mutate(() => getProAdapter().confirm(sessionId)),
    redeemCode: (code) => mutate(() => getProAdapter().demoUnlock(code)),
  };
});

/** Back to the defaults and forget any request in flight (tests). */
export function resetProStore(): void {
  epoch += 1;
  inflight = null;
  useProStore.setState(initialProData());
}

/** Show the cached hint until the server answers. Browser only; a no-op once anything is known. */
function restoreCache(): void {
  if (useProStore.getState().origin !== 'default') return;
  const cached = readCache();
  if (cached) useProStore.setState({ status: cached, origin: 'cache' });
}

export type ProVM = Pick<ProData, 'status' | 'origin' | 'load' | 'error' | 'checkoutAvailable' | 'demo'> & {
  isPro: boolean;
  /** False until the server answered or a cached hint was read (the first render is always free). */
  known: boolean;
  refresh: () => Promise<void>;
};

/** Pro status for any screen. Reads the cached hint, then asks the server, on every mount. */
export function usePro(): ProVM {
  const s = useProStore();
  useEffect(() => {
    restoreCache();
    void useProStore.getState().refresh();
  }, []);
  return {
    status: s.status,
    origin: s.origin,
    load: s.load,
    error: s.error,
    checkoutAvailable: s.checkoutAvailable,
    demo: s.demo,
    isPro: s.status.pro,
    known: s.origin !== 'default',
    refresh: s.refresh,
  };
}
