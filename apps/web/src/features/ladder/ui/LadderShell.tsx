// The frame of every ladder rung (S5–S9): heading, intro, the screen's content, then the ladder
// progress (rungs done, the 10-year number and how far its range has narrowed) and the CTAs.
import type { ReactNode } from 'react';
import { ladder, screenTitles } from '@/copy';
import { Stack } from '@/ui-kit';
import type { LadderProgressVM, LadderScreen } from '../model/types';
import { LadderProgress } from './LadderProgress';
import { LoadingState } from './LoadingState';

export type LadderShellProps = {
  screen: LadderScreen;
  progress: LadderProgressVM;
  /** The screen's own view-model is still loading (saved state not read yet). */
  loading?: boolean;
  children: ReactNode;
};

export function LadderShell({ screen, progress, loading = false, children }: LadderShellProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <Stack gap="xl">
        <header className="flex flex-col gap-sm">
          <h1 className="text-4xl leading-display sm:text-display">{screenTitles[screen]}</h1>
          <p className="text-base text-text-muted">{ladder.shell.intro[screen]}</p>
        </header>
        {loading ? <LoadingState /> : children}
        <LadderProgress screen={screen} progress={progress} />
      </Stack>
    </main>
  );
}
