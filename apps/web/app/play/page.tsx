'use client';

// /play is the daily game. By default it is the duel ("Which life costs more?": S2 Duel round, S3
// Reveal and Day result; also at /duel), played in the browser or against the server routes per
// NEXT_PUBLIC_DUEL_SOURCE (production switches to the server in #120). NEXT_PUBLIC_GAME_MODE=slider is the rollback to the slider game: S2 Explore the home +
// guess, S3 Reveal and summary, S4 Streamer mode with ?stream=1. Thin: the hook builds the
// view-model, the UI renders it.
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
  // Read inline: Next inlines NEXT_PUBLIC_* at build time (same rule as gameMode() in lib/config).
  if (process.env.NEXT_PUBLIC_GAME_MODE === 'slider') return <SliderPlay streamer={stream === '1'} />;
  return <DuelView challenged={typeof c === 'string' && c.length > 0} />;
}
