// The daily log's input: one text field (typed or filled by the mic), preset chips, the
// confirmation of what the AI (or our fallback) read, and Undo after a save. Used on /spend and
// on Home. Presentational: everything comes from QuickAddVM.
import { useId } from 'react';
import { common, spend as t } from '@/copy';
import { Button, formatMoney, Row, Select, Stack } from '@/ui-kit';
import type { QuickAddVM } from '../model/types';

export type QuickAddProps = { vm: QuickAddVM; className?: string };

export function QuickAdd({ vm, className }: QuickAddProps) {
  const inputId = useId();
  const hintId = useId();
  const busy = vm.status === 'parsing';
  const confirming = vm.status === 'confirming';
  const locked = !vm.ready || busy || confirming;
  const errorText =
    vm.error?.kind === 'noAmount' ? t.errors.noAmount(vm.error.part) : vm.error?.kind === 'nothing' ? t.errors.nothing : null;

  return (
    <Stack gap="md" className={className} data-testid="quick-add">
      <form
        className="flex flex-col gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          vm.submit();
        }}
      >
        <label htmlFor={inputId} className="text-sm font-semibold">
          {t.input.label}
        </label>
        <div className="flex flex-wrap items-stretch gap-sm">
          <input
            id={inputId}
            type="text"
            inputMode="text"
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby={hintId}
            value={vm.text}
            onChange={(e) => vm.setText(e.target.value)}
            placeholder={t.input.placeholder}
            disabled={locked}
            className="min-h-11 min-w-0 flex-1 basis-40 rounded-md border border-border bg-bg px-md py-sm text-base text-text disabled:bg-surface"
          />
          {vm.speech.supported && (
            <Button
              variant="secondary"
              aria-pressed={vm.speech.listening}
              aria-label={vm.speech.listening ? t.input.micStop : t.input.mic}
              onClick={vm.speech.toggle}
              disabled={locked}
              data-testid="spend-mic"
            >
              <span aria-hidden="true">{vm.speech.listening ? '■' : '🎤'}</span>
              <span className="sr-only sm:not-sr-only">{vm.speech.listening ? t.input.micStop : t.input.mic}</span>
            </Button>
          )}
          <Button type="submit" variant="dark" disabled={locked || !vm.text.trim()}>
            {busy ? t.input.reading : t.input.add}
          </Button>
        </div>
        <p id={hintId} className="text-xs text-text-muted">
          {t.input.hint}
        </p>
        <p aria-live="polite" className="text-xs text-text-muted empty:hidden">
          {vm.speech.listening ? t.input.listening : vm.speech.error ? t.input.micError : busy ? t.input.reading : ''}
        </p>
      </form>

      {errorText && (
        <p role="alert" className="rounded-md border border-warning bg-surface px-md py-sm text-sm">
          {errorText}
        </p>
      )}

      {confirming && (
        <section aria-label={t.confirm.title} data-testid="spend-confirm" className="flex flex-col gap-md rounded-md bg-bg p-md">
          <h3 className="text-base font-semibold">{t.confirm.title}</h3>
          <p className="text-xs text-text-muted">{vm.draftSource === 'ai' ? t.confirm.aiNote : t.confirm.localNote}</p>
          <ul className="flex flex-col gap-sm">
            {vm.drafts.map((d) => {
              const what = d.label ?? formatMoney(d.amount, { cents: true });
              return (
                <li key={d.key} className="flex flex-wrap items-center justify-between gap-sm rounded-md bg-surface px-md py-sm">
                  <span className="min-w-0 text-sm font-medium">{d.label ?? '—'}</span>
                  <span className="flex items-center gap-sm">
                    <Select
                      size="sm"
                      fullWidth={false}
                      aria-label={t.confirm.categoryLabel(what)}
                      value={d.categoryGuessed ? '' : d.category}
                      onChange={(e) => vm.setDraftCategory(d.key, e.target.value as typeof d.category)}
                      needsReview={d.categoryGuessed}
                    >
                      {d.categoryGuessed && (
                        <option value="" disabled>
                          {t.confirm.guessed}
                        </option>
                      )}
                      {vm.categories.map((c) => (
                        <option key={c} value={c}>
                          {common.categories[c]}
                        </option>
                      ))}
                    </Select>
                    <span className="font-semibold tabular-nums">{formatMoney(d.amount, { cents: true })}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <Row>
            <Button variant="dark" onClick={vm.confirm} disabled={vm.drafts.some((d) => d.categoryGuessed)}>
              {t.confirm.save}
            </Button>
            <Button variant="ghost" onClick={vm.cancel}>
              {t.confirm.cancel}
            </Button>
          </Row>
        </section>
      )}

      <div className="flex flex-col gap-xs">
        <span className="section-label">{t.presets.title}</span>
        <ul className="flex flex-wrap gap-xs">
          {vm.presets.map((p) => {
            const name = t.presets.names[p.id];
            const amount = formatMoney(p.amount);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => vm.addPreset(p.id)}
                  disabled={!vm.ready}
                  aria-label={t.presets.aria(name, amount)}
                  className="inline-flex min-h-11 items-center gap-xs rounded-full border border-border bg-surface px-md text-sm font-medium transition hover:border-primary hover:bg-primary-soft active:scale-95 disabled:opacity-50 motion-reduce:transition-none"
                >
                  <span aria-hidden="true">{p.emoji}</span>
                  <span>{name}</span>
                  <span className="tabular-nums text-text-muted">{amount}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-text-muted">{t.presets.note}</p>
      </div>

      <div aria-live="polite" className="empty:hidden">
        {vm.lastAdded && (
          <p className="animate-fade flex flex-wrap items-center gap-sm rounded-md bg-positive-soft px-md py-xs text-sm" data-testid="spend-added">
            <span>{t.added(vm.lastAdded.count)}</span>
            <Button size="sm" variant="ghost" onClick={vm.undo}>
              {t.undo}
            </Button>
          </p>
        )}
      </div>
    </Stack>
  );
}
