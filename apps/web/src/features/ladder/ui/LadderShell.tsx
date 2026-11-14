// The frame of every ladder rung (S5–S9), as in the Figma frames: a dark "STEP N OF 5" pill above
// a big display headline and the intro, then the screen's content, then the ladder progress (rungs
// done, the 10-year number and how far its range has narrowed) and the CTAs.
import type { ReactNode } from 'react';
import { ladder, screenTitles } from '@/copy';
import { PageHeader, Stack } from '@/ui-kit';
import type { LadderProgressVM, LadderScreen } from '../model/types';
import { LadderProgress } from './LadderProgress';
import { LoadingState } from './LoadingState';

const t = ladder.shell;

/** Rung order, for the "Step N of 5" pill (display only). */
const ORDER: readonly LadderScreen[] = ['S5', 'S6', 'S7', 'S8', 'S9'];

export type LadderShellProps = {
  screen: LadderScreen;
  progress: LadderProgressVM;
  /** The screen's own view-model is still loading (saved state not read yet). */
  loading?: boolean;
  /** Center the header (S5, S6) as in their frames. */
  centered?: boolean;
  children: ReactNode;
};

export function LadderShell({ screen, progress, loading = false, centered = false, children }: LadderShellProps) {
  const step = t.step(ORDER.indexOf(screen) + 1, ORDER.length);
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      <Stack gap="2xl">
        <PageHeader
          eyebrow={screen === 'S9' ? `${step} · ${t.optional}` : step}
          title={screenTitles[screen]}
          intro={t.intro[screen]}
          align={centered ? 'center' : 'start'}
        />
        {loading ? <LoadingState /> : children}
        <LadderProgress screen={screen} progress={progress} />
      </Stack>
    </main>
  );
}
