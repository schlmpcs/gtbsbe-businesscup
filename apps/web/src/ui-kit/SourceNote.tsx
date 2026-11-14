'use client';

import type { Source } from '@lifeguessr/types';
import { useId, useState } from 'react';
import { common } from '@/copy';
import { cx } from './cx';

export type SourceNoteProps = {
  source: Source;
  /**
   * footnote (default): always-visible small print under the value.
   * toggle: a small "Source" button that shows the same text on tap (for tight rows).
   */
  variant?: 'footnote' | 'toggle';
  className?: string;
};

function SourceText({ source }: { source: Source }) {
  const name = source.url ? (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {source.name}
      <span className="sr-only"> {common.kit.opensInNewTab}</span>
    </a>
  ) : (
    source.name
  );
  return (
    <>
      {common.kit.sourcePrefix} {name}, {source.year}
    </>
  );
}

/** Where a number comes from ("Source: HUD Fair Market Rents, 2025"), linked when it has a URL. */
export function SourceNote({ source, variant = 'footnote', className }: SourceNoteProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (variant === 'footnote') {
    return (
      <p className={cx('text-xs leading-normal text-text-muted', className)}>
        <SourceText source={source} />
      </p>
    );
  }

  return (
    <span className={cx('inline-flex flex-col items-start text-xs leading-normal text-text-muted', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="rounded-sm underline decoration-dotted underline-offset-2 hover:text-text"
      >
        {open ? common.kit.hideSource : common.kit.showSource}
      </button>
      <span id={panelId} hidden={!open}>
        <SourceText source={source} />
      </span>
    </span>
  );
}
