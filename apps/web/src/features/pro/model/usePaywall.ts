// S15 Pro paywall (demo, no real money): pick a plan → Stripe Checkout in test mode → back on
// /pro?checkout=success&session_id=cs_test_… → the server confirms the session; or, when the server
// has no Stripe key, pay in the simulated in-app checkout; or unlock with the promo code the screen
// shows. The server is the authority on Pro; this hook only drives the flow.
import { PRO_PLANS, PRO_PRICES, ProConfirmRequestSchema, type ProPlan, type ProStatus } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getProAdapter, type ProFailure, type ProResult } from '@/lib/api/pro';
import { useTrackOnce } from '@/lib/events';
import { SCREEN_ROUTES } from '@/lib/screens';
import { usePro, useProStore } from '@/state';
import type { CheckoutMode, PaywallError, PaywallErrorKey, PaywallPlanVM, PaywallVM } from './types';

const RETURN_PARAMS = ['checkout', 'session_id'] as const;

const FAILURE_KEY: Record<ProFailure['kind'], PaywallErrorKey> = {
  badRequest: 'badRequest',
  rateLimited: 'rateLimited',
  unavailable: 'unavailable',
  upstream: 'upstream',
  notPaid: 'notPaid',
  sessionMismatch: 'sessionMismatch',
  invalidCode: 'invalidCode',
  network: 'network',
  invalidResponse: 'invalidResponse',
};

// A confirm that failed for these reasons may succeed if asked again; the others never will.
const CONFIRM_RETRYABLE = new Set<PaywallErrorKey>(['network', 'unavailable', 'upstream', 'rateLimited', 'invalidResponse', 'notPaid']);

function toError(where: PaywallError['where'], failure: ProFailure): PaywallError {
  return { where, key: FAILURE_KEY[failure.kind], retryAfterSeconds: failure.kind === 'rateLimited' ? failure.retryAfterSeconds : null };
}

const sinceFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

/** Drop the Stripe return parameters so a reload or a shared link does not replay them. */
function cleanReturnUrl(): void {
  const url = new URL(window.location.href);
  for (const p of RETURN_PARAMS) url.searchParams.delete(p);
  // Keep history.state: the Next.js router stores its own entry there.
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** The Stripe return query (`?checkout=success&session_id=…` or `?checkout=cancelled`), read by the page. */
export type CheckoutReturnParams = { checkout?: string; sessionId?: string };

type CheckoutReturn =
  | { kind: 'none' }
  | { kind: 'cancelled' }
  | { kind: 'invalid' }
  | { kind: 'success'; sessionId: string };

function checkoutReturnOf(params: CheckoutReturnParams | undefined): CheckoutReturn {
  if (params?.checkout === 'cancelled') return { kind: 'cancelled' };
  if (params?.checkout !== 'success') return { kind: 'none' };
  // Validate before anything is sent: a malformed or live-mode id never reaches the server.
  const req = ProConfirmRequestSchema.safeParse({ sessionId: params.sessionId ?? '' });
  return req.success ? { kind: 'success', sessionId: req.data.sessionId } : { kind: 'invalid' };
}

const BAD_RETURN: PaywallError = { where: 'confirm', key: 'badReturn', retryAfterSeconds: null };

export type UsePaywallOptions = {
  /** The page's query string when Stripe sent the user back; omitted on a normal visit. */
  checkoutReturn?: CheckoutReturnParams;
  /** Leave for the Stripe-hosted checkout page (tests replace it; jsdom cannot navigate). */
  navigate?: (url: string) => void;
};

const assignLocation = (url: string) => window.location.assign(url);

export function usePaywall({ checkoutReturn, navigate = assignLocation }: UsePaywallOptions = {}): PaywallVM {
  const pro = usePro();
  // Fixed for the life of the screen: the URL is cleaned once it has been handled.
  const [arrival] = useState(() => checkoutReturnOf(checkoutReturn));
  const returnedSession = arrival.kind === 'success' ? arrival.sessionId : null;

  const [plan, setPlan] = useState<ProPlan>('yearly');
  const [promoDraft, setPromoDraft] = useState<string | null>(null);
  // Back from Stripe = confirming from the first render (server render included), so no flash of the offer.
  const [busy, setBusy] = useState<PaywallVM['busy']>(returnedSession ? 'confirm' : null);
  const [actionError, setActionError] = useState<PaywallError | null>(arrival.kind === 'invalid' ? BAD_RETURN : null);
  const [cancelled, setCancelled] = useState(arrival.kind === 'cancelled');
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);

  // A ref, not state: two clicks in the same frame both see the old `busy` state.
  const busyRef = useRef(returnedSession !== null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const returnHandled = useRef(false);

  const begin = useCallback((what: NonNullable<PaywallVM['busy']>): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(what);
    setActionError(null);
    setCancelled(false);
    return true;
  }, []);

  const end = useCallback(() => {
    busyRef.current = false;
    setBusy(null);
  }, []);

  const fail = useCallback((where: PaywallError['where'], failure: ProFailure) => {
    const error = toError(where, failure);
    setActionError(error);
    if (error.retryAfterSeconds !== null) {
      clearTimeout(cooldownTimer.current);
      setCoolingDown(true);
      cooldownTimer.current = setTimeout(() => {
        setCoolingDown(false);
        setActionError((e) => (e === error ? null : e)); // its "wait N seconds" is now stale
      }, error.retryAfterSeconds * 1000);
    }
  }, []);

  useEffect(() => () => clearTimeout(cooldownTimer.current), []);

  const unlocked = useCallback((status: ProStatus) => {
    if (status.pro) setJustUnlocked(true);
  }, []);

  /** Apply the server's answer to a confirm (the screen was marked busy when it was sent). */
  const settleConfirm = useCallback(
    (res: ProResult<ProStatus>) => {
      if (res.ok) unlocked(res.value);
      else fail('confirm', res.error);
      end();
    },
    [end, fail, unlocked],
  );

  // Coming back from Stripe: confirm once (a ref, so a Strict Mode re-run cannot confirm twice),
  // then drop the return parameters from the address bar.
  useEffect(() => {
    if (returnHandled.current || arrival.kind === 'none') return;
    returnHandled.current = true;
    if (arrival.kind !== 'success') {
      cleanReturnUrl();
      return;
    }
    void useProStore
      .getState()
      .confirmCheckout(arrival.sessionId)
      .then((res) => {
        settleConfirm(res);
        cleanReturnUrl();
      });
  }, [arrival, settleConfirm]);

  // Back button from Stripe: a page restored from the back-forward cache still says "redirecting".
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) end();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [end]);

  const startCheckout = useCallback(async () => {
    if (coolingDown || !pro.checkoutAvailable || pro.isPro || !begin('checkout')) return;
    const res = await getProAdapter().startCheckout(plan);
    if (res.ok) {
      navigate(res.value); // stay busy: the page is leaving
      return;
    }
    fail('checkout', res.error);
    end();
  }, [begin, coolingDown, end, fail, navigate, plan, pro.checkoutAvailable, pro.isPro]);

  // Stripe wins when the server has a test key; otherwise the simulated checkout, which the server
  // switches off together with the promo code (PRO_DEMO_UNLOCK=off).
  const checkoutMode: CheckoutMode = pro.checkoutAvailable ? 'stripe' : pro.demo.enabled ? 'demo' : 'off';

  const payDemo = useCallback(async () => {
    if (coolingDown || checkoutMode !== 'demo' || pro.isPro || !begin('demoCheckout')) return;
    const res = await useProStore.getState().demoCheckout(plan);
    if (res.ok) unlocked(res.value);
    else fail('checkout', res.error);
    end();
  }, [begin, checkoutMode, coolingDown, end, fail, plan, pro.isPro, unlocked]);

  const promoCode = promoDraft ?? pro.demo.code ?? '';

  const redeem = useCallback(async () => {
    if (coolingDown || pro.isPro) return;
    const code = promoCode.trim();
    if (!code) {
      setActionError({ where: 'promo', key: 'emptyCode', retryAfterSeconds: null });
      return;
    }
    if (!begin('promo')) return;
    const res = await useProStore.getState().redeemCode(code);
    if (res.ok) unlocked(res.value);
    else fail('promo', res.error);
    end();
  }, [begin, coolingDown, end, fail, pro.isPro, promoCode, unlocked]);

  const setPromoCode = useCallback((code: string) => {
    setPromoDraft(code);
    setActionError((e) => (e?.where === 'promo' && e.key !== 'rateLimited' ? null : e));
  }, []);

  const statusError: PaywallError | null =
    pro.load === 'error' && pro.origin !== 'server' && pro.error ? toError('status', pro.error) : null;
  const error = actionError ?? statusError;

  const refreshStatus = pro.refresh;
  const retry = useMemo(() => {
    if (coolingDown || !error) return null;
    if (error.where === 'status') return () => void refreshStatus();
    if (error.where === 'confirm' && returnedSession && CONFIRM_RETRYABLE.has(error.key)) {
      return () => {
        if (begin('confirm')) void useProStore.getState().confirmCheckout(returnedSession).then(settleConfirm);
      };
    }
    return null;
  }, [begin, coolingDown, error, refreshStatus, returnedSession, settleConfirm]);

  const plans: PaywallPlanVM[] = useMemo(
    () => PRO_PLANS.map((id) => ({ id, ...PRO_PRICES[id], isEstimate: true as const, selected: id === plan })),
    [plan],
  );

  const status = pro.status;
  // The cached hint skips the loading state only when it says Pro. A free hint says nothing about
  // which checkout this server runs, so an offer built from it would use the pre-answer defaults
  // (no checkout, no promo) and then jump when the answer lands. Wait for the server instead; a
  // failed status request still ends on the offer, with the error and a retry.
  const serverAnswered = pro.origin === 'server' || pro.load === 'error';
  const view: PaywallVM['view'] =
    busy === 'confirm'
      ? 'confirming'
      : status.pro
        ? justUnlocked ? 'success' : 'pro'
        : serverAnswered ? 'offer' : 'loading';
  // Saw the offer (checkout and unlocks are recorded by the server routes themselves).
  useTrackOnce(view === 'offer', 'paywall_viewed', { name: 'paywall_viewed' });

  return {
    view,
    plans,
    selectPlan: setPlan,
    checkoutMode,
    startCheckout: () => void startCheckout(),
    payDemo: () => void payDemo(),
    promoEnabled: pro.demo.enabled,
    promoCode,
    setPromoCode,
    redeem: () => void redeem(),
    busy,
    coolingDown,
    cancelled,
    error,
    retry,
    pro: status.pro ? { source: status.source, plan: status.plan ?? null, sinceLabel: sinceFormat.format(new Date(status.since)) } : null,
    continueHref: SCREEN_ROUTES.S11,
  };
}
