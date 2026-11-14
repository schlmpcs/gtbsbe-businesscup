'use client';

// S2 Explore the home + guess; S3 Reveal and the day's summary are states of this page after a
// guess; S4 Streamer mode with ?stream=1. Thin: the hook builds the view-model, the UI renders it.
import { use } from 'react';
import { usePlay } from '@/features/game/model/usePlay';
import { PlayScreen } from '@/features/game/ui/PlayScreen';
import { SCREEN_ROUTES } from '@/lib/screens';

export default function PlayPage({ searchParams }: { searchParams: Promise<{ stream?: string | string[] }> }) {
  const { stream } = use(searchParams);
  const vm = usePlay({ streamer: stream === '1' });
  return <PlayScreen vm={vm} guessOwnHref={SCREEN_ROUTES.S5} />;
}
