// "Estimate with AI" for one account's yearly change (Add account and Account detail). The AI only
// PROPOSES the rate (/api/ai/growth, checked there and again here against aiGrowthEnvelope); it fills the
// field, labeled "AI estimate" with its reason, and the person can edit it. plan() and monteCarlo() do
// every projection with whatever rate is saved. Sent: the account's type, the name typed and its value.
import { growthEstimateIssues } from '@lifeguessr/engine';
import {
  GROWTH_ESTIMATE_ACCOUNT_GROUPS, type AccountGroup, type AiGrowthNote, type GrowthEstimateAccountGroup, type Money, type Rate,
} from '@lifeguessr/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { accounts as copy } from '@/copy';
import { estimateGrowth } from '@/lib/api/aiGrowth';
import { ApiError } from '@/lib/api/http';
import { getAnonId } from '@/state/anonId';
import type { GrowthAiFieldVM } from './types';

/** What the AI put in the field: the rate, its reason, and the text written (the label holds while the text is unchanged). */
export type AiFill = { rate: Rate; reason: string; text: string };

/** −0.12 → "-12", 0.0487 → "4.87": a rate as typed in the percent field (parsePercent reads it back exactly). */
export const rateText = (rate: Rate): string => String(Math.round(rate * 10_000) / 100);

export function hasGrowthField(group: AccountGroup | null): group is GrowthEstimateAccountGroup {
  return group !== null && (GROWTH_ESTIMATE_ACCOUNT_GROUPS as readonly string[]).includes(group);
}

/** The AI note to store with a rate: only while the field still holds the AI's text. */
export function noteFor(fill: AiFill | null, text: string): AiGrowthNote | null {
  return fill !== null && fill.text === text.trim() ? { source: 'ai', reason: fill.reason } : null;
}

type ErrorKey = keyof typeof copy.growthAi.errors;
function errorKey(err: unknown): ErrorKey {
  if (err instanceof ApiError && (err.code === 'unavailable' || err.status === 503)) return 'unavailable';
  if (err instanceof ApiError && (err.code === 'rate_limited' || err.status === 429)) return 'rateLimited';
  return 'failed';
}

export type GrowthAiInput = { group: GrowthEstimateAccountGroup; name: string; value: Money };

/**
 * The request state of "Estimate with AI". `onFill` gets a rate that passed the envelope; on any failure
 * nothing is filled and `message` says why. `input` is null while there is nothing to send.
 */
export function useGrowthAiField(input: GrowthAiInput | null, onFill: (fill: AiFill) => void): [GrowthAiFieldVM, () => void] {
  const [state, setState] = useState<{ status: GrowthAiFieldVM['status']; error: ErrorKey | null }>({ status: 'idle', error: null });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const onFillRef = useRef(onFill);
  useEffect(() => {
    onFillRef.current = onFill;
  });

  const ask = useCallback(() => {
    if (input === null) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ status: 'loading', error: null });
    const { group, name, value } = input;
    estimateGrowth({ mode: 'account', account: { group, name: name.trim(), value } }, { anonId: getAnonId(), signal: controller.signal }).then(
      (res) => {
        if (controller.signal.aborted) return;
        const e = res.estimates.find((x) => x.group === group);
        if (!e || growthEstimateIssues(group, e.rate).length > 0) {
          setState({ status: 'error', error: 'failed' });
          return;
        }
        onFillRef.current({ rate: e.rate, reason: e.reason, text: rateText(e.rate) });
        setState({ status: 'filled', error: null });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', error: errorKey(err) });
      },
    );
  }, [input]);

  /** A new type or a cleared form starts over (an answer still on its way is dropped). */
  const reset = useCallback(() => {
    abort.current?.abort();
    setState({ status: 'idle', error: null });
  }, []);

  const vm: GrowthAiFieldVM = { status: state.status, canAsk: input !== null, message: state.error === null ? null : copy.growthAi.errors[state.error], ask };
  return [vm, reset];
}
