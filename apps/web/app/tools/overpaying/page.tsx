'use client';

// S23 Overpaying check (M11): thin route. The view-model hook feeds the presentational screen.
// `?stream=1` (streamer mode) hides the tool. The last inputs live in the store under `tools.overpaying`.
import { use } from 'react';
import { useOverpaying } from '@/features/overpaying/model/useOverpaying';
import { useOwnProfile } from '@/features/overpaying/model/useOwnProfile';
import { OverpayingScreen } from '@/features/overpaying/ui/OverpayingScreen';
import { useAppStore } from '@/state';

export default function OverpayingPage({ searchParams }: { searchParams: Promise<{ stream?: string | string[] }> }) {
  const { stream } = use(searchParams);
  const stored = useAppStore((s) => s.tools.overpaying);
  const setTool = useAppStore((s) => s.setTool);
  const vm = useOverpaying(useOwnProfile(), {
    streamer: stream === '1',
    stored,
    onStore: (state) => setTool('overpaying', state),
  });
  return <OverpayingScreen vm={vm} />;
}
