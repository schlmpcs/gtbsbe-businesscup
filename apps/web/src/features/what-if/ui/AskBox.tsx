import { useEffect, useId, useRef } from 'react';
import { whatIf as t } from '@/copy';
import { Button, cx, formatMoney } from '@/ui-kit';
import type { AskVM, Letter } from '../model/types';
import { factText } from './facts';
import { LETTER_BG } from './ChoiceCard';

export type AskBoxProps = {
  ask: AskVM;
  /** "Change" on a card: focus the field and offer that side first. */
  target: Letter | null;
};

function errorText(ask: AskVM): string {
  const e = ask.error;
  if (!e) return '';
  if (e.kind === 'nothingFound') return t.ask.errors.nothingFound;
  if (e.kind === 'incomplete') {
    return e.missing.includes('move.zip') ? t.ask.errors.placeMissing(ask.metros.join(', ')) : t.ask.errors.incomplete;
  }
  if (e.kind === 'rateLimited') return t.ask.errors.rateLimited;
  return t.ask.errors.unknown;
}

/** The "What if…" field: a sentence → the change we read → the user puts it in A or B. */
export function AskBox({ ask, target }: AskBoxProps) {
  const inputId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const busy = ask.status === 'parsing';
  const confirming = ask.status === 'confirming' && ask.confirm;

  useEffect(() => {
    if (target) input.current?.focus();
  }, [target]);

  const order: Letter[] = target === 'B' ? ['B', 'A'] : ['A', 'B'];

  return (
    <section aria-labelledby={inputId} className="flex flex-col gap-md rounded-xl bg-surface p-lg shadow-md sm:p-xl">
      <form
        className="flex flex-col gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          ask.submit();
        }}
      >
        <label htmlFor={inputId} className="font-display text-2xl font-extrabold leading-tight">
          {t.ask.label}
        </label>
        <div className="flex flex-col gap-sm sm:flex-row">
          <input
            ref={input}
            id={inputId}
            aria-describedby={hintId}
            value={ask.text}
            onChange={(e) => ask.setText(e.target.value)}
            placeholder={t.ask.placeholder}
            disabled={busy || Boolean(confirming)}
            maxLength={300}
            className="min-w-0 flex-1 rounded-lg border-2 border-border bg-bg px-lg py-md text-base focus:border-primary focus:outline-none disabled:opacity-70"
          />
          <Button type="submit" disabled={busy || Boolean(confirming) || !ask.text.trim()}>
            {busy ? t.ask.reading : t.ask.submit}
          </Button>
        </div>
        <p id={hintId} className="text-xs text-text-muted">
          {t.ask.hint}
        </p>
      </form>

      {ask.status === 'error' && ask.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-sm rounded-lg bg-surface-strong p-md">
          <p className="text-sm">{errorText(ask)}</p>
          <Button size="sm" variant="ghost" onClick={ask.cancel}>
            {t.ask.discard}
          </Button>
        </div>
      )}

      {confirming && ask.confirm && (
        <div role="region" aria-label={t.ask.confirmTitle} data-testid="what-if-confirm" className="flex flex-col gap-md rounded-lg border-2 border-dashed border-primary bg-primary-soft p-md sm:p-lg">
          <div className="flex flex-wrap items-baseline justify-between gap-sm">
            <h3 className="text-base font-bold">{t.ask.confirmTitle}</h3>
            <span className="text-xs text-text-muted">{t.ask.readBy[ask.confirm.parsedBy]}</span>
          </div>
          <p className="flex flex-wrap items-center gap-sm">
            <span className="rounded-full bg-ink px-md py-xs text-sm font-bold text-on-primary">{t.changeKinds[ask.confirm.kind]}</span>
            {ask.confirm.facts.map((f, i) => (
              <span key={`${f.kind}-${i}`} className="rounded-full bg-surface px-md py-xs text-sm font-semibold">
                {factText(f)}
              </span>
            ))}
          </p>
          {ask.confirm.place && (
            <p className="text-sm">{t.ask.placeNote(ask.confirm.place.metro, ask.confirm.place.zip, ask.confirm.place.tier)}</p>
          )}
          {ask.confirm.raise && (
            <p className="text-sm">
              {t.ask.raiseNote(formatMoney(ask.confirm.raise.grossYearly), formatMoney(ask.confirm.raise.monthlyDelta))}
            </p>
          )}
          {ask.confirm.noTiming && <p className="text-sm text-text-muted">{t.ask.noTimingNote}</p>}
          <div className="flex flex-wrap gap-sm">
            {order.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => ask.putIn(l)}
                className={cx(
                  'inline-flex items-center gap-sm rounded-lg px-lg py-md font-bold text-on-primary shadow-sm transition-opacity hover:opacity-90',
                  LETTER_BG[l],
                )}
              >
                {t.ask.putIn(l)}
              </button>
            ))}
            <Button variant="secondary" onClick={ask.cancel}>
              {t.ask.discard}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
