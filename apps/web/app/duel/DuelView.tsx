'use client';

// The duel ("Which life costs more?"): S2 Duel round, S3 Reveal and S3 Day result. Thin: the hook
// builds the view-model, the UI renders it. Rendered by /play (the default game) and /duel; with
// NEXT_PUBLIC_GAME_MODE=slider only by /duel.
import { useDuel } from '@/features/game/model/useDuel';
import { DuelScreen } from '@/features/game/ui/DuelScreen';
import { SCREEN_ROUTES } from '@/lib/screens';

export function DuelView({ challenged = false }: { challenged?: boolean }) {
  const vm = useDuel({ challenged });
  return <DuelScreen vm={vm} guessOwnHref={SCREEN_ROUTES.S5} />;
}
