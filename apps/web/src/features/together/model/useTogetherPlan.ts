// /together/<id>: the shared plan. Partner 1 (the browser that created it) sees the link to share
// while waiting, then the household view. Anyone else who opens the link is partner 2: they add
// their numbers, then see the same view. Every number comes from ./compute.ts (the engine).
import type { TogetherPartner, TogetherPlan } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { runEngine, toVMError } from '@/lib/model/errors';
import { useAppReady } from '@/state';
import { createTogetherClient, rememberRole, roleIn, type TogetherClient } from './client';
import { togetherResult } from './compute';
import type { TogetherPlanVM, TogetherRole, VMError } from './types';
import { usePartnerForm } from './usePartnerForm';

type LoadState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; error: VMError }
  | { status: 'ready'; plan: TogetherPlan; role: TogetherRole };

const hasBoth = (plan: TogetherPlan): plan is TogetherPlan & { partner2: TogetherPartner } => plan.partner2 !== null;

function currentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

export function useTogetherPlan(id: string, client?: TogetherClient): TogetherPlanVM {
  const ready = useAppReady();
  const api = useMemo(() => client ?? createTogetherClient(), [client]);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<VMError | null>(null);
  const [copied, setCopied] = useState(false);
  const plan = state.status === 'ready' ? state.plan : null;
  const form = usePartnerForm();

  useEffect(() => {
    let live = true;
    api
      .load(id, currentHash())
      .then((loaded) => {
        if (!live) return;
        setState(loaded ? { status: 'ready', plan: loaded, role: roleIn(loaded.id) } : { status: 'notFound' });
      })
      .catch((err: unknown) => {
        if (live) setState({ status: 'error', error: toVMError(err) });
      });
    return () => {
      live = false;
    };
  }, [api, id, attempt]);

  const sharePath = plan ? api.sharePath(plan) : '';
  // Fixture links carry the plan: keep the address bar on the newest copy, so a reload or a share
  // from the browser menu has both partners once partner 2 has added theirs.
  useEffect(() => {
    if (api.source === 'fixtures' && sharePath && typeof window !== 'undefined') {
      const target = sharePath.slice(sharePath.indexOf('#'));
      if (window.location.hash !== target) window.history.replaceState(window.history.state, '', sharePath);
    }
  }, [api.source, sharePath]);

  const url = typeof window === 'undefined' || !sharePath ? sharePath : new URL(sharePath, window.location.origin).toString();

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [url]);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = useCallback(() => {
    void navigator.share?.({ url }).catch(() => undefined);
  }, [url]);

  const result = useMemo(() => (plan && hasBoth(plan) ? runEngine(() => togetherResult(plan)) : null), [plan]);

  if (state.status === 'loading' || !ready) return { status: 'loading' };
  if (state.status === 'notFound') return { status: 'notFound' };
  if (state.status === 'error') return { status: 'error', error: state.error, retry: () => setAttempt((n) => n + 1) };

  const { role } = state;
  const current = state.plan;
  const waiting = current.partner2 === null;
  const showForm = role === 'partner2' && (waiting || editing);

  const submit = () => {
    const built = form.build();
    if (!built || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    api
      // A blank goal keeps the plan's goal (partner 1 may have set one); a filled one replaces it.
      .setPartner2(current, built.partner, built.goal ?? undefined)
      .then((next) => {
        rememberRole(next.id, 'partner2');
        setState({ status: 'ready', plan: next, role: 'partner2' });
        setEditing(false);
      })
      .catch((err: unknown) => setSubmitError(toVMError(err)))
      .finally(() => setSubmitting(false));
  };

  return {
    status: 'ready',
    role,
    storage: api.source,
    names: { p1: current.partner1.nickname ?? null, p2: current.partner2?.nickname ?? null },
    expiresOn: new Date(current.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    share: { url, copy, share: canShare ? share : null, copied },
    waiting,
    refresh: role === 'partner1' && waiting && api.source === 'api' ? () => setAttempt((n) => n + 1) : null,
    form: showForm ? form.vm : null,
    submit,
    submitting,
    submitError,
    editMine: role === 'partner2' && !waiting && !editing ? () => setEditing(true) : null,
    cancelEdit: editing ? () => setEditing(false) : null,
    result: result?.status === 'ready' ? result.data : null,
    resultError: result?.status === 'error' ? result.error : null,
  };
}
