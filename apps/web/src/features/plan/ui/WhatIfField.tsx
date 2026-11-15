'use client';

// "Write your what-if" on /plan: one sentence in, plan events out. Presentational: props in (WhatIfVM),
// events out. Claude parses the sentence; the engine computes every amount the chips show.
import { useId } from 'react';
import { plan as copy } from '@/copy';
import { Button, EstimateTag, Tag } from '@/ui-kit';
import type { WhatIfVM } from '../model/types';
import { EventBadge } from './EventIcon';

export function WhatIfField({ vm }: { vm: WhatIfVM }) {
  const t = copy.whatIf;
  const inputId = useId();
  const noteId = useId();
  const busy = vm.status === 'loading';

  return (
    <section aria-labelledby={`${inputId}-title`} className="card card-pad flex flex-col gap-md">
      <div className="flex flex-wrap items-center gap-sm">
        <h2 id={`${inputId}-title`} className="text-lg font-bold">
          {t.title}
        </h2>
        <Tag className="border-primary font-bold text-primary">{t.badge}</Tag>
        <p id={noteId} className="text-xs text-text-muted">
          {t.note}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          vm.submit();
        }}
        className="flex flex-col gap-sm sm:flex-row sm:items-center"
      >
        <label htmlFor={inputId} className="sr-only">
          {t.label}
        </label>
        <input
          id={inputId}
          type="text"
          name="whatIf"
          autoComplete="off"
          enterKeyHint="go"
          maxLength={400}
          value={vm.text}
          onChange={(e) => vm.setText(e.target.value)}
          placeholder={t.placeholder}
          aria-describedby={noteId}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-md text-base font-semibold placeholder:font-normal placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <Button type="submit" className="min-h-11 shrink-0" disabled={busy || vm.text.trim() === ''} aria-busy={busy || undefined}>
          {busy ? t.loading : t.submit}
        </Button>
      </form>

      <div aria-live="polite" className="flex flex-col gap-sm empty:hidden">
        {vm.lastAdded.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <p className="text-sm font-semibold">{t.added(vm.lastAdded.length)}</p>
              <button
                type="button"
                onClick={vm.undo}
                className="min-h-11 px-sm text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {t.undo}
              </button>
            </div>
            <ul className="flex flex-wrap gap-sm">
              {vm.lastAdded.map((chip) => (
                <li key={chip.id} className="flex min-w-0 max-w-full items-center gap-sm rounded-lg border border-border bg-bg py-xs pl-xs pr-md">
                  <EventBadge id={chip.icon} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold">
                      {chip.label} <span className="font-normal text-text-muted">· {chip.year}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-xs text-xs text-text-muted">
                      <span>{chip.amountText}</span>
                      {chip.isEstimate && <EstimateTag />}
                    </span>
                    <span className="text-xs text-text-muted">{chip.source}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {vm.error && (
          <p role={vm.status === 'error' ? 'alert' : undefined} className="text-sm text-text-muted">
            {vm.error}
          </p>
        )}
      </div>
    </section>
  );
}
