'use client';

// S2 Explore the home + guess; S3 Reveal and the day's summary are states of this page after a
// guess; S4 Streamer mode with ?stream=1. Thin: the hook builds the view-model, the UI renders it.
// NEXT_PUBLIC_GAME_MODE=duel plays the duel ("Which life costs more?", also at /duel) here instead;
// unset, /play stays the slider game.
import { use } from 'react';
import { usePlay } from '@/features/game/model/usePlay';
import { PlayScreen } from '@/features/game/ui/PlayScreen';
import { SCREEN_ROUTES } from '@/lib/screens';
import { DuelView } from '../duel/DuelView';

type PlaySearchParams = { stream?: string | string[]; c?: string | string[] };

function SliderPlay({ streamer }: { streamer: boolean }) {
  const vm = usePlay({ streamer });
  return <PlayScreen vm={vm} guessOwnHref={SCREEN_ROUTES.S5} />;
}

export default function PlayPage({ searchParams }: { searchParams: Promise<PlaySearchParams> }) {
  const { stream, c } = use(searchParams);
  // Read inline: Next inlines NEXT_PUBLIC_* at build time.
  if (process.env.NEXT_PUBLIC_GAME_MODE === 'duel') return <DuelView challenged={typeof c === 'string' && c.length > 0} />;
  return <SliderPlay streamer={stream === '1'} />;
}
