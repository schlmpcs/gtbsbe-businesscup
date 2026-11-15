// The story's frame (/start): which chapter is on screen (the URL's ?ch, read by the route), how far
// the person got, and the end of the story. Reaching chapter 4 finishes it: from then on "/" sends the
// person to /dashboard. The practice duel's error is kept for chapter 2's bridge line.
import { useCallback, useEffect } from 'react';
import { useAppReady } from '@/state';
import { useOnboardingRecord, writeRecord } from './onboardingStore';
import type { ChapterId, StoryVM } from './types';

export function useStory(chapter: ChapterId, navigate: (chapter: ChapterId) => void): StoryVM {
  const ready = useAppReady();
  const record = useOnboardingRecord();
  const loaded = ready && record !== undefined;

  // Reaching a chapter moves the bookmark forward; chapter 4 ends the story.
  useEffect(() => {
    if (!loaded) return;
    const reached = Math.max(record?.chapter ?? 1, chapter) as ChapterId;
    if (record && record.chapter === reached && (chapter !== 4 || record.done)) return;
    writeRecord({ chapter: reached, ...(chapter === 4 ? { done: true } : {}) });
  }, [loaded, record, chapter]);

  const finish = useCallback(() => {
    writeRecord({ done: true });
  }, []);
  const setPracticeError = useCallback((error: number) => {
    writeRecord({ practiceError: error });
  }, []);

  return {
    status: loaded ? 'ready' : 'loading',
    chapter,
    reached: Math.max(record?.chapter ?? 1, chapter) as ChapterId,
    goTo: navigate,
    finish,
    practiceError: record?.practiceError ?? null,
    setPracticeError,
  };
}
