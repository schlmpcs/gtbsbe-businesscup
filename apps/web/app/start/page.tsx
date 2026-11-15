'use client';

// /start: the onboarding. One round of today's duel → "What are you worth?" → connect a bank → the
// analysis → the answer → your plan to 90 → one decision. Thin route: the view-model hooks feed the
// presentational screens; the duel round is the game's own warm-up (features/game).
import Link from 'next/link';
import { onboarding as copy } from '@/copy';
import { useDuel } from '@/features/game/model/useDuel';
import { DuelWarmup } from '@/features/game/ui/DuelWarmup';
import { useOnboarding } from '@/features/onboarding/model/useOnboarding';
import { Onboarding } from '@/features/onboarding/ui/Onboarding';
import { SCREEN_ROUTES } from '@/lib/screens';

export default function StartPage() {
  const vm = useOnboarding();
  const duel = useDuel();
  return (
    <Onboarding
      vm={vm}
      Link={Link}
      uploadHref={SCREEN_ROUTES.S9}
      doneHref="/"
      warmup={<DuelWarmup vm={duel} onContinue={vm.finishWarmup} continueLabel={copy.warmup.cta} sticker={copy.warmup.sticker} />}
    />
  );
}
