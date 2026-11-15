'use client';

// The subscription audit, connected: the view-model feeds the presentational screen, and the cancel plan
// (what is ticked to stop) is measured on the person's /plan by the engine (usePlanImpact: plan() with and
// without the move, on this device; no request) and can be added to it as a Next Move.
import type { Move } from '@lifeguessr/types';
import { useCallback, type ComponentType, type ReactNode } from 'react';
import { track as defaultTrack } from '@/lib/events';
import { useProfile } from '@/state';
import { usePlanImpact } from './model/usePlanImpact';
import { useSubscriptions, type SubscriptionsDeps } from './model/useSubscriptions';
import { SubscriptionsScreen } from './ui/SubscriptionsScreen';

export type LinkComponent = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

export function SubscriptionsTool({ deps, Link }: { deps: SubscriptionsDeps; Link?: LinkComponent }) {
  const profile = useProfile();
  const vm = useSubscriptions(profile, deps);
  const track = deps.track ?? defaultTrack;
  const onAdded = useCallback((move: Move) => track({ name: 'move_committed', props: { kind: move.kind } }), [track]);
  const impact = usePlanImpact(vm.plan.candidate, { onAdded });
  return <SubscriptionsScreen vm={vm} impact={impact} Link={Link} />;
}
