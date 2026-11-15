'use client';

// S23 Overpaying check (M11): thin route. The view-model hook feeds the presentational screen.
// `?stream=1` (streamer mode) hides the tool. The last inputs live in the store under `tools.overpaying`.
import { use, useMemo } from 'react';
import { useOverpaying } from '@/features/overpaying/model/useOverpaying';
import { useOwnProfile } from '@/features/overpaying/model/useOwnProfile';
import { OverpayingScreen } from '@/features/overpaying/ui/OverpayingScreen';
import { useAppStore } from '@/state';
import { BackToTools } from '../../_components/BackToTools';

export default function OverpayingPage({ searchParams }: { searchParams: Promise<{ stream?: string | string[] }> }) {
  const { stream } = use(searchParams);
  const stored = useAppStore((s) => s.tools.overpaying);
  const setTool = useAppStore((s) => s.setTool);
  // "About you" (S6): the household the person typed prefills the form.
  const facts = useAppStore((s) => s.profile.householdFacts);
  const zip = useAppStore((s) => s.profile.zip);
  const household = useMemo(() => (facts ? { facts, zip: zip ?? null } : null), [facts, zip]);
  const vm = useOverpaying(useOwnProfile(), {
    streamer: stream === '1',
    stored,
    onStore: (state) => setTool('overpaying', state),
    household,
  });
  return (
    <>
      <BackToTools />
      <OverpayingScreen vm={vm} />
    </>
  );
}
