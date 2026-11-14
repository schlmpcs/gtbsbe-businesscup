'use client';

// S23 Overpaying check (M11): thin route. The view-model hook feeds the presentational screen.
// `?stream=1` (streamer mode) hides the tool. The last inputs are not kept in the store yet: when
// `tools.overpaying` exists (issue #78), pass `stored` and `onStore` to useOverpaying.
import { use } from 'react';
import { useOverpaying } from '@/features/overpaying/model/useOverpaying';
import { useOwnProfile } from '@/features/overpaying/model/useOwnProfile';
import { OverpayingScreen } from '@/features/overpaying/ui/OverpayingScreen';

export default function OverpayingPage({ searchParams }: { searchParams: Promise<{ stream?: string | string[] }> }) {
  const { stream } = use(searchParams);
  const vm = useOverpaying(useOwnProfile(), { streamer: stream === '1' });
  return <OverpayingScreen vm={vm} />;
}
