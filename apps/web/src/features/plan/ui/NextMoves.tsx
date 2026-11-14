// Next Moves (usePlanMoves): ranked by the dollars each adds at retirement, in the order the hook gives.
import { plan as copy } from '@/copy';
import { Button, Card, Tag, cx } from '@/ui-kit';
import type { PlanMovesVM } from '../model/types';

export function NextMoves({ vm }: { vm: PlanMovesVM }) {
  const t = copy.screen.moves;
  return (
    <Card title={copy.moves.title}>
      <p className="mb-md text-sm text-text-muted">{t.intro}</p>
      {vm.moves.length === 0 ? (
        <p className="text-sm text-text-muted">{t.empty}</p>
      ) : (
        <ol className="flex flex-col gap-md">
          {vm.moves.map((m, i) => (
            <li key={m.id} data-move={m.id} className="flex flex-col gap-sm rounded-md border border-border p-md">
              <div className="flex items-start gap-md">
                <span aria-hidden="true" className="flex size-2xl shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-on-primary">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-xs">
                  <span className="sr-only">{t.rank(i + 1)}</span>
                  <span className="font-semibold">{m.title}</span>
                  <span className={cx('font-display text-xl font-extrabold tabular-nums', m.tone === 'bad' ? 'text-negative' : 'text-positive')}>
                    {m.effectAtRetirement}
                  </span>
                  <span className="text-sm text-text-muted">{m.successRateDelta}</span>
                </div>
              </div>
              <p className="text-sm">{m.explanation}</p>
              <div>
                {m.added ? (
                  <Tag>{copy.moves.added}</Tag>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => vm.addToPlan(m.id)}>
                    {t.add}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
