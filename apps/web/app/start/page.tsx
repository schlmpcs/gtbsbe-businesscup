'use client';

// /start: the onboarding story in 4 chapters (features/onboarding), the chapter in the URL (?ch=2…4) so
// Back works and a chapter can be opened directly (the ladder's last step opens chapter 4). Each chapter
// reuses the existing view-models: the practice duel (chapter 1), useGuessYourself + useClosestLife
// (2), useStatementUpload + useQuickSliders + the month reveal (3), and the /plan hooks (4).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback } from 'react';
import { useClosestLife } from '@/features/ladder/model/useClosestLife';
import { useGuessYourself } from '@/features/ladder/model/useGuessYourself';
import { useQuickSliders } from '@/features/ladder/model/useQuickSliders';
import { useStatementUpload } from '@/features/ladder/model/useStatementUpload';
import { useMonthReveal } from '@/features/onboarding/model/monthReveal';
import { chapterHref, DASHBOARD_ROUTE, isChapter } from '@/features/onboarding/model/onboardingStore';
import type { ChapterId } from '@/features/onboarding/model/types';
import { usePracticeDuel } from '@/features/onboarding/model/usePracticeDuel';
import { useRunChanceOnEnter } from '@/features/onboarding/model/useRunOnEnter';
import { useStory } from '@/features/onboarding/model/useStory';
import { ChapterFuture } from '@/features/onboarding/ui/ChapterFuture';
import { ChapterGuess } from '@/features/onboarding/ui/ChapterGuess';
import { ChapterMonth } from '@/features/onboarding/ui/ChapterMonth';
import { ChapterPractice } from '@/features/onboarding/ui/ChapterPractice';
import { StoryFrame } from '@/features/onboarding/ui/StoryFrame';
import { useChanceOfSuccess } from '@/features/plan/model/useChanceOfSuccess';
import { usePlan } from '@/features/plan/model/usePlan';
import { usePlanMoves } from '@/features/plan/model/usePlanMoves';
import { useScenarios } from '@/features/plan/model/useScenarios';
import { SCREEN_ROUTES } from '@/lib/screens';

type SearchParams = Promise<{ ch?: string | string[] }>;

const chapterOf = (v: string | string[] | undefined): ChapterId => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return isChapter(n) ? n : 1;
};

const LINKS = { dashboard: DASHBOARD_ROUTE, plan: '/plan', exact: SCREEN_ROUTES.S8 };

export default function StartPage({ searchParams }: { searchParams: SearchParams }) {
  const chapter = chapterOf(use(searchParams).ch);
  const router = useRouter();
  const navigate = useCallback((n: ChapterId) => router.push(chapterHref(n)), [router]);
  const story = useStory(chapter, navigate);

  const practice = usePracticeDuel({ onFinish: (s) => s && story.setPracticeError(s.averageError) });
  const guess = useGuessYourself();
  const closest = useClosestLife();
  const upload = useStatementUpload();
  const sliders = useQuickSliders();
  const reveal = useMonthReveal();
  const scenarios = useScenarios();
  const plan = usePlan(scenarios.activeId);
  const chance = useChanceOfSuccess();
  const moves = usePlanMoves();
  useRunChanceOnEnter(chance, chapter === 4, story.status === 'ready');

  return (
    <StoryFrame chapter={chapter} reached={story.reached} onGoTo={navigate} Link={Link} homeHref="/">
      {chapter === 1 && <ChapterPractice vm={practice} onDone={() => navigate(2)} dailyHref={SCREEN_ROUTES.S2} />}
      {chapter === 2 && <ChapterGuess guess={guess} closest={closest} practiceError={story.practiceError} onDone={() => navigate(3)} />}
      {chapter === 3 && <ChapterMonth upload={upload} sliders={sliders} reveal={reveal} onDone={() => navigate(4)} />}
      {chapter === 4 && <ChapterFuture plan={plan} chance={chance} moves={moves} Link={Link} links={LINKS} />}
    </StoryFrame>
  );
}
