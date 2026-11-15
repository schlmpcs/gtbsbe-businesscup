// "Try with sample data" (S1 → /future?sample=1): load the sample life (profile.demo.json) as the
// session profile, flagged isSample, once saved state is loaded. Only for a browser without a
// profile of its own: the store refuses to overwrite one. The query is dropped afterwards so a
// reload or a shared link does not load it again. The sample life comes with its sample plan
// (scenario.demo.json: Buy a home in 2033, and its Compare pair), so /plan and the home Life line show it.
import { useEffect, useRef } from 'react';
import { usePlanStore } from '@/features/plan/model/planStore';
import { track } from '@/lib/events';
import { useAppReady, useAppStore } from '@/state';

function dropSampleParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('sample')) return;
  url.searchParams.delete('sample');
  // Keep history.state: the Next.js router stores its own entry there.
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function useSampleRequest(requested: boolean): void {
  const ready = useAppReady();
  const loadSample = useAppStore((s) => s.loadSample);
  const done = useRef(false);
  useEffect(() => {
    if (!requested || !ready || done.current) return;
    done.current = true;
    if (loadSample()) {
      usePlanStore.getState().loadSample();
      track({ name: 'sample_loaded' });
    }
    dropSampleParam();
  }, [requested, ready, loadSample]);
}
