// Net worth goal (S10). Presentational: the rules-based status, saving solve and move shares all
// arrive from the goal view-model; here they are only formatted.
import { common, forecast, goal as t } from '@/copy';
import { Button, cx, formatMoney, formatRate, NumberInput, Sticker } from '@/ui-kit';
import type { GoalVM } from '../model/types';
import type { LinkComponent } from './shared';

export type GoalCardProps = {
  vm: GoalVM;
  /** "Make it exact →" (statement upload), shown when the route passes both. */
  makeExactHref?: string;
  Link?: LinkComponent;
  className?: string;
};

const VERDICT_TONE = { onTrack: 'positive', withinRange: 'primary', behind: 'primary' } as const;

export function GoalCard({ vm, makeExactHref, Link, className }: GoalCardProps) {
  const target = vm.goal?.target ?? vm.presets.targets[1]!;
  const years = vm.goal?.years ?? 10;
  const status = vm.status.status === 'ready' ? vm.status.data : null;
  const saving = vm.saving.status === 'ready' ? vm.saving.data : null;
  const moves = vm.moves.status === 'ready' ? vm.moves.data : null;

  const form = (
    <div className="flex flex-col gap-md">
      <div className="grid gap-md sm:grid-cols-2">
        <label className="flex flex-col gap-xs text-sm font-semibold">
          {t.target}
          <NumberInput value={target} min={1} prefix="$" onValueChange={(value) => vm.setGoal({ target: value ?? 0, years })} />
        </label>
        <label className="flex flex-col gap-xs text-sm font-semibold">
          {t.years}
          <NumberInput
            value={years}
            min={1}
            max={30}
            maxFractionDigits={0}
            onValueChange={(value) => vm.setGoal({ target, years: value ?? 0 })}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-sm">
        {vm.presets.targets.map((value) => (
          <Button key={value} variant="secondary" size="sm" onClick={() => vm.setGoal({ target: value, years })}>
            {formatMoney(value)}
          </Button>
        ))}
        {vm.presets.years.map((value) => (
          <Button key={value} variant="secondary" size="sm" onClick={() => vm.setGoal({ target, years: value })}>
            {value} {t.years}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <section className={cx('flex flex-col gap-md rounded-xl bg-surface p-xl shadow-md', className)} data-testid="goal-card">
      <h2 className="text-xl font-bold leading-tight">{vm.goal ? t.summary(formatMoney(vm.goal.target), vm.goal.years) : t.title}</h2>

      {status && (
        <>
          <Sticker tone={VERDICT_TONE[status.verdict]} tilt={-3} className="text-sm">
            <span data-testid="goal-verdict">{t.verdictLabel[status.verdict]}</span>
          </Sticker>
          <p className="text-sm text-text-muted">{t.verdict[status.verdict]}</p>
          <progress
            className="h-2 w-full accent-primary"
            aria-label={t.progress}
            max={1}
            value={Math.max(0, Math.min(1, status.progress))}
          />
          <dl className="grid grid-cols-2 gap-x-lg gap-y-sm text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-text-muted">{t.projected}</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(status.projected.low)} – {formatMoney(status.projected.high)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">{t.progress}</dt>
              <dd className="font-semibold tabular-nums">{formatRate(status.progress)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">{t.gap}</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(status.gap)}</dd>
            </div>
            {saving && (
              <div>
                <dt className="text-xs text-text-muted">{t.saving}</dt>
                <dd className="font-semibold tabular-nums">{saving.reachable ? formatMoney(saving.extraMonthly) : t.unreachable}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      {moves && (
        <div className="text-sm">
          <h3 className="font-bold">{t.moveShare}</h3>
          <ul className="mt-xs flex flex-col gap-xs">
            {moves.perMove.map((move) => {
              const label = vm.moveLabels.find((m) => m.id === move.moveId);
              return (
                <li key={move.moveId} className="flex justify-between gap-md">
                  <span>
                    {label
                      ? forecast.moves.title(label.kind, label.category ? common.categories[label.category] : undefined)
                      : ''}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {move.shareOfGap === null ? t.noGap : formatRate(move.shareOfGap)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-xs flex justify-between gap-md border-t border-border pt-xs">
            <span>{t.combined}</span>
            <span className="font-semibold tabular-nums">
              {moves.combined.shareOfGap === null ? t.noGap : formatRate(moves.combined.shareOfGap)}
            </span>
          </p>
        </div>
      )}

      {vm.goal ? (
        <details className="group text-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-xs font-semibold text-primary">
            {t.edit}
            <span aria-hidden="true" className="transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="mt-sm">{form}</div>
        </details>
      ) : (
        form
      )}

      {vm.inputError && (
        <p role="alert" className="text-sm text-negative">
          {t.invalid}
        </p>
      )}
      {vm.status.status === 'loading' && <p className="text-sm text-text-muted">{t.loading}</p>}
      {vm.status.status === 'error' && (
        <p role="alert" className="text-sm text-negative">
          {t.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-sm">
        {!vm.goal && <Button onClick={() => vm.setGoal({ target, years })}>{t.start}</Button>}
        {vm.goal && (
          <Button variant="ghost" size="sm" onClick={vm.clearGoal}>
            {t.clear}
          </Button>
        )}
        {makeExactHref && Link && (
          <Link href={makeExactHref} className="text-sm font-semibold text-primary hover:underline">
            {t.makeExact} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      <p className="text-xs text-text-muted">{t.computed}</p>
    </section>
  );
}
