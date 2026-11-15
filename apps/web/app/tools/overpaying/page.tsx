'use client';

// S23 Overpaying check (M11): thin route. The view-model hooks feed the presentational screen: the check
// itself (useOverpaying), each line above its range measured on the plan (useOverpayingImpacts) and the
// person's transactions as monthly averages for the prefill (useLedgerAverages). `?stream=1` (streamer
// mode) hides the tool. The last inputs live in the store under `tools.overpaying`.
import Link from 'next/link';
import { use, useMemo } from 'react';
import { useLedgerAverages } from '@/features/overpaying/model/ledger';
import { useOverpayingImpacts } from '@/features/overpaying/model/planMoves';
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
  const ledger = useLedgerAverages();
  const vm = useOverpaying(useOwnProfile(), {
    streamer: stream === '1',
    stored,
    onStore: (state) => setTool('overpaying', state),
    household,
    ledger,
  });
  const impacts = useOverpayingImpacts(vm.hidden ? null : vm.result);
  return (
    <>
      <BackToTools />
      <OverpayingScreen vm={vm} impacts={impacts} Link={Link} />
    </>
  );
}
