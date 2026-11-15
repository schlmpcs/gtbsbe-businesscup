// "/" for this browser: a first visit gets the landing (one Start); a story in progress gets "Continue";
// a finished story, or a profile built before the story existed (the old /me ladder), goes to
// /dashboard. "See a sample plan" loads the sample household and opens /plan with the sample notice.
import type { Profile } from '@lifeguessr/types';
import { onboarding } from '@/copy';
import { profileDemo } from '@/fixtures';
import { formatMoney, formatRate } from '@/lib/format';
import type { ProfileOrigin } from '@/state';
import { useCallback } from 'react';
import { track } from '@/lib/events';
import { useAppReady, useAppStore } from '@/state';
import { chapterHref, DASHBOARD_ROUTE, START_ROUTE, useOnboardingRecord } from './onboardingStore';
import type { LandingVM, OnboardingRecord } from './types';

export const SAMPLE_PLAN_ROUTE = '/plan';
export const PLAY_ROUTE = '/play';

/** The demo profile's facts for the landing's "sample life" card: the fixture's own values, formatted. */
export function sampleFactsOf(p: Profile): LandingVM['sampleFacts'] {
  const t = onboarding.landing.life;
  const debt = (kind: string) => p.debts.find((d) => d.kind === kind);
  const card = debt('card');
  const auto = debt('auto');
  return [
    { id: 'age' as const, value: String(p.age.value) },
    { id: 'takeHome' as const, value: t.perMonth(formatMoney(p.takeHomePay.value)) },
    { id: 'rent' as const, value: t.perMonth(formatMoney(p.spending.rentUtilities.value)) },
    ...(card ? [{ id: 'card' as const, value: t.debt(formatMoney(card.balance), formatRate(card.apr)) }] : []),
    ...(auto ? [{ id: 'auto' as const, value: t.debt(formatMoney(auto.balance), formatRate(auto.apr)) }] : []),
    { id: 'cash' as const, value: formatMoney(p.cash.value) },
  ];
}
const SAMPLE_FACTS = sampleFactsOf(profileDemo);

/** What the landing does, from the story's record and whether the profile is the person's own. */
export function landingMode(
  record: OnboardingRecord | null,
  profileOrigin: ProfileOrigin,
): Pick<LandingVM, 'mode' | 'resumeChapter'> {
  if (record?.done) return { mode: 'redirect', resumeChapter: null };
  if (record && record.chapter > 1) return { mode: 'continue', resumeChapter: record.chapter };
  // Built a profile on the ladder before the story existed: that person has finished onboarding.
  if (!record && profileOrigin !== 'demo') return { mode: 'redirect', resumeChapter: null };
  return { mode: 'fresh', resumeChapter: null };
}

export function useLanding(): LandingVM {
  const ready = useAppReady();
  const record = useOnboardingRecord();
  const profileOrigin = useAppStore((s) => s.profileOrigin);
  const loadSample = useAppStore((s) => s.loadSample);

  const seeSample = useCallback(() => {
    if (loadSample()) track({ name: 'sample_loaded' });
  }, [loadSample]);

  const { mode, resumeChapter } =
    !ready || record === undefined ? { mode: 'loading' as const, resumeChapter: null } : landingMode(record, profileOrigin);
  return {
    mode,
    redirectTo: DASHBOARD_ROUTE,
    startHref: resumeChapter ? chapterHref(resumeChapter) : START_ROUTE,
    restartHref: START_ROUTE,
    resumeChapter,
    sampleHref: SAMPLE_PLAN_ROUTE,
    playHref: PLAY_ROUTE,
    sampleFacts: SAMPLE_FACTS,
    seeSample,
  };
}
