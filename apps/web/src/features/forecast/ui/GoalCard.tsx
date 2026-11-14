import { common, forecast, goal as t } from '@/copy';
import { Button, Card, LockNotice, NumberInput, formatMoney, formatRate } from '@/ui-kit';
import type { GoalVM } from '../model/types';
/** Presentational rules-based goal card; all calculations and state arrive from its model. */
export function GoalCard({ vm }: { vm: GoalVM }) {
  // Goal setting and tracking is Pro: free users see the lock, and their number stays free above.
  if (vm.access !== 'open') {
    return (
      <Card className="flex flex-col gap-md" data-testid="goal-card" data-access={vm.access}>
        <h2 className="text-xl font-bold">{t.title}</h2>
        {vm.access === 'loading' ? (
          <p aria-busy="true" className="text-sm text-text-muted">
            {t.checkingPro}
          </p>
        ) : (
          <LockNotice
            title={t.lock.title}
            body={t.lock.body}
            ctaLabel={t.lock.cta}
            href={vm.proHref}
            className="bg-surface-strong"
          />
        )}
      </Card>
    );
  }
  const target = vm.goal?.target ?? vm.presets.targets[1]!,
    years = vm.goal?.years ?? 10;
  const status = vm.status.status === 'ready' ? vm.status.data : null;
  const saving = vm.saving.status === 'ready' ? vm.saving.data : null;
  const moves = vm.moves.status === 'ready' ? vm.moves.data : null;
  return (
    <Card className="flex flex-col gap-md" data-testid="goal-card" data-access={vm.access}>
      <h2 className="text-xl font-bold">{t.title}</h2>
      <p className="text-sm text-text-muted">{t.computed}</p>
      <label>
        {t.target}
        <NumberInput
          value={target}
          min={1}
          prefix="$"
          onValueChange={(value) => vm.setGoal({ target: value ?? 0, years })}
        />
      </label>
      <label>
        {t.years}
        <NumberInput
          value={years}
          min={1}
          max={30}
          maxFractionDigits={0}
          onValueChange={(value) => vm.setGoal({ target, years: value ?? 0 })}
        />
      </label>
      <div className="flex flex-wrap gap-sm">
        {vm.presets.targets.map((value) => (
          <Button
            key={value}
            variant="secondary"
            size="sm"
            onClick={() => vm.setGoal({ target: value, years })}
          >
            {formatMoney(value)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-sm">
        {vm.presets.years.map((value) => (
          <Button
            key={value}
            variant="secondary"
            size="sm"
            onClick={() => vm.setGoal({ target, years: value })}
          >
            {value} {t.years}
          </Button>
        ))}
      </div>
      {vm.inputError && <p role="alert">{t.invalid}</p>}
      {vm.status.status === 'loading' && <p>{t.loading}</p>}
      {vm.status.status === 'error' && <p role="alert">{t.error}</p>}
      {!vm.goal && (
        <Button onClick={() => vm.setGoal({ target, years })}>{t.start}</Button>
      )}
      {status && (
        <>
          <p className="font-bold">{t.verdict[status.verdict]}</p>
          <dl className="grid grid-cols-2 gap-md">
            <dt>{t.projected}</dt>
            <dd>
              {formatMoney(status.projected.low)} –{' '}
              {formatMoney(status.projected.high)}
            </dd>
            <dt>{t.progress}</dt>
            <dd>{formatRate(status.progress)}</dd>
            <dt>{t.gap}</dt>
            <dd>{formatMoney(status.gap)}</dd>
            {saving && (
              <>
                <dt>{t.saving}</dt>
                <dd>
                  {saving.reachable
                    ? formatMoney(saving.extraMonthly)
                    : t.unreachable}
                </dd>
              </>
            )}
          </dl>
          <progress
            className="w-full accent-primary"
            aria-label={t.progress}
            max={1}
            value={Math.max(0, Math.min(1, status.progress))}
          />
        </>
      )}
      {moves && (
        <div>
          <h3 className="font-bold">{t.moveShare}</h3>
          <ul>
            {moves.perMove.map((move) => {
              const label = vm.moveLabels.find((m) => m.id === move.moveId);
              return (
                <li key={move.moveId}>
                  {label
                    ? forecast.moves.title(
                        label.kind,
                        label.category
                          ? common.categories[label.category]
                          : undefined,
                      )
                    : ''}
                  :{' '}
                  {move.shareOfGap === null
                    ? t.noGap
                    : formatRate(move.shareOfGap)}
                </li>
              );
            })}
          </ul>
          <p>
            {t.combined}:{' '}
            {moves.combined.shareOfGap === null
              ? t.noGap
              : formatRate(moves.combined.shareOfGap)}
          </p>
        </div>
      )}
      {vm.goal && (
        <Button variant="ghost" onClick={vm.clearGoal}>
          {t.clear}
        </Button>
      )}
    </Card>
  );
}
