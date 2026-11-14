'use client';

// The subscription audit, connected: the view-model feeds the presentational screen, and the cancel plan's
// measured part (the 10-year number, which asks the forecast route) is mounted only while the plan step
// shows at least one mark. A cold visit, a guess, ticks, or an empty plan send no forecast request.
import type { Profile } from '@lifeguessr/types';
import type { MoveCandidate } from '@lifeguessr/engine';
import { useAppStore } from '@/state';
import { useCancelResult } from './model/useCancelResult';
import { useSubscriptions, type SubscriptionsDeps } from './model/useSubscriptions';
import type { PlanVM } from './model/types';
import { CancelEffect } from './ui/CancelEffect';
import { SubscriptionsScreen } from './ui/SubscriptionsScreen';

/** Exists only while there is a candidate to measure (see `useCancelResult`). */
function CancelResults({ profile, candidate, plan, deps }: { profile: Profile; candidate: MoveCandidate; plan: PlanVM; deps: SubscriptionsDeps }) {
  const result = useCancelResult(profile, candidate, { track: deps.track });
  return <CancelEffect plan={plan} result={result} />;
}

export function SubscriptionsTool({ deps }: { deps: SubscriptionsDeps }) {
  const profile = useAppStore((s) => s.profile);
  const vm = useSubscriptions(profile, deps);
  const { candidate } = vm.plan;
  const planResults =
    vm.step === 'plan' && candidate !== null ? <CancelResults profile={profile} candidate={candidate} plan={vm.plan} deps={deps} /> : null;
  return <SubscriptionsScreen vm={vm} planResults={planResults} />;
}
