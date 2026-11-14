// Placeholder screen shell: heading with the screen ID. Each feature task replaces its page body.
import type { ReactNode } from 'react';
import { common, screenTitles, type ScreenId } from '@/copy';

export function ScreenPage({ id, children }: { id: ScreenId; children?: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <h1 className="text-2xl font-semibold leading-tight">
        <span className="text-text-muted">{id}</span> {screenTitles[id]}
      </h1>
      <p className="mt-sm text-sm text-text-muted">{common.nav.placeholderNote}</p>
      {children}
    </main>
  );
}
