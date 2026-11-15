'use client';

// /start: the onboarding. One round of today's duel → about you → "What are you worth?" → connect a
// bank (or upload a statement) → the analysis → "here's what we found, anything else?" → the answer →
// your plan to 90 → one decision. Thin route: the view-model hooks feed the presentational screens;
// the duel round is the game's own warm-up (features/game).
import Link from 'next/link';
import { lifeline as lifelineCopy, welcome as copy } from '@/copy';
import { useDuel } from '@/features/game/model/useDuel';
import { DuelWarmup } from '@/features/game/ui/DuelWarmup';
import { LifeLineChart } from '@/features/lifeline/ui/LifeLineHero';
import { useOnboarding } from '@/features/welcome/model/useOnboarding';
import { Onboarding } from '@/features/welcome/ui/Onboarding';

export default function StartPage() {
  const vm = useOnboarding();
  const duel = useDuel();
  return (
    <Onboarding
      vm={vm}
      Link={Link}
      doneHref="/dashboard"
      decisionChart={vm.lifeline.status === 'ready' ? (
        <LifeLineChart
          chart={vm.lifeline.chart}
          drag={{ min: vm.lifeline.slider.min, max: vm.lifeline.slider.max, onAge: vm.lifeline.setAge, hint: lifelineCopy.chart.dragHint, showHint: false }}
        />
      ) : null}
      warmup={<DuelWarmup vm={duel} onContinue={vm.finishWarmup} continueLabel={copy.warmup.cta} sticker={copy.warmup.sticker} />}
    />
  );
}
