// "/" for this browser: a first visit gets the landing (one Start); a story in progress gets "Continue";
// a finished story, or a profile built before the story existed (the old /me ladder), goes to
// /dashboard. "See a sample plan" loads the sample household and opens /plan with the sample notice.
import type { ProfileOrigin } from '@/state';
import { useCallback } from 'react';
import { track } from '@/lib/events';
import { useAppReady, useAppStore } from '@/state';
import { chapterHref, DASHBOARD_ROUTE, START_ROUTE, useOnboardingRecord } from './onboardingStore';
import type { LandingVM, OnboardingRecord } from './types';

export const SAMPLE_PLAN_ROUTE = '/plan';

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
    seeSample,
  };
}
