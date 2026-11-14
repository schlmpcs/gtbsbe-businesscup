// Next Moves (S10): the top 3 moves with their 10-year effect, commit / done, "Why?", and the
// level 2 preview. Presentational: everything comes from the view-model.
import { forecast as t } from '@/copy';
import { Button, Card, cx, formatMoney, Stack, Sticker } from '@/ui-kit';
import type { ExplanationVM, Loadable, MoveVM, NextMovesVM } from '../model/types';
import { ErrorNote, moveDetail, moveTitle, Skeleton } from './shared';

export type NextMovesProps = {
  vm: NextMovesVM;
  explanations: Record<string, Loadable<ExplanationVM>>;
  onExplain: (moveId: string) => void;
  loading?: boolean;
};

export function NextMoves({ vm, explanations, onExplain, loading = false }: NextMovesProps) {
  const m = t.moves;
  let body;
  if (loading || vm.moves.status === 'loading') body = <Skeleton />;
  else if (vm.moves.status === 'error') body = <ErrorNote error={vm.moves.error} />;
  else if (vm.moves.data.length === 0) body = <p className="text-sm text-text-muted">{m.empty}</p>;
  else {
    body = (
      <ol className="grid items-start gap-lg md:grid-cols-2 lg:grid-cols-3" data-testid="moves">
        {vm.moves.data.map((move, i) => (
          <MoveItem
            key={move.id}
            rank={i + 1}
            move={move}
            explanation={explanations[move.id]}
            onCommit={() => vm.commit(move.id)}
            onUncommit={vm.uncommit}
            onDone={() => vm.markDone(move.id)}
            onExplain={() => onExplain(move.id)}
          />
        ))}
      </ol>
    );
  }

  return (
    <section aria-labelledby="moves-heading" className="flex flex-col gap-lg">
      <div>
        <h2 id="moves-heading" className="text-4xl font-extrabold leading-tight">
          {m.heading}
        </h2>
        <p className="mt-xs text-text-muted">{m.intro}</p>
        {!loading && vm.doneCount > 0 && <p className="mt-xs text-sm text-positive">{m.doneCount(vm.doneCount)}</p>}
      </div>
      {body}
      {!loading && <LevelTwoPreview level={vm.level} kinds={vm.level2Kinds} />}
    </section>
  );
}

function MoveItem({
  rank,
  move,
  explanation,
  onCommit,
  onUncommit,
  onDone,
  onExplain,
}: {
  rank: number;
  move: MoveVM;
  explanation: Loadable<ExplanationVM> | undefined;
  onCommit: () => void;
  onUncommit: () => void;
  onDone: () => void;
  onExplain: () => void;
}) {
  const m = t.moves;
  const title = moveTitle(move);
  const detail = moveDetail(move);
  const headingId = `move-${move.id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  return (
    <li>
      <Card
        as="article"
        aria-labelledby={headingId}
        data-move-id={move.id}
        data-committed={move.isCommitted ? 'true' : 'false'}
        className={cx('h-full border-2', move.isCommitted ? 'border-positive' : 'border-transparent')}
      >
        <Stack gap="sm">
          <div className="flex items-center gap-sm">
            <Sticker tone={move.isCommitted ? 'positive' : 'ink'}>
              <span aria-hidden="true">{m.rank(rank)}</span>
            </Sticker>
            <h3 id={headingId} className="min-w-0 flex-1 text-lg font-bold leading-tight">
              {title}
            </h3>
          </div>

          <div>
            <p className="font-display text-5xl font-extrabold leading-tight text-positive tabular-nums">
              {formatMoney(move.effect10y, { signed: true })}
            </p>
            <p className="text-xs text-text-muted">{m.effectLabel}</p>
          </div>
          {detail && <p className="text-sm text-text-muted">{detail}</p>}

          {move.isCommitted && (
            <p className="self-start rounded-full bg-positive-soft px-md py-xs text-xs font-bold text-positive" data-testid="committed-badge">
              {m.committed}
            </p>
          )}

          <div className="flex flex-wrap gap-sm">
            {move.isCommitted ? (
              <Button size="sm" variant="secondary" onClick={onUncommit}>
                {m.uncommit}
              </Button>
            ) : (
              <Button size="sm" onClick={onCommit}>
                {m.commit}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onDone}>
              {m.markDone}
            </Button>
            {explanation?.status !== 'ready' && explanation?.status !== 'error' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onExplain}
                disabled={explanation?.status === 'loading'}
                aria-label={`${m.why} ${title}`}
              >
                {m.why}
              </Button>
            )}
          </div>

          <div aria-live="polite">
            {explanation?.status === 'loading' && <p className="text-sm text-text-muted">{m.whyLoading}</p>}
            {explanation?.status === 'ready' && (
              <div className="rounded-md bg-surface p-md text-sm">
                <p>{explanation.data.text}</p>
                <p className="mt-xs text-xs text-text-muted">{explanation.data.fromAi ? m.whyAi : m.whyTemplate}</p>
              </div>
            )}
            {explanation?.status === 'error' && (
              <div className="flex flex-wrap items-center gap-sm">
                <ErrorNote error={explanation.error} />
                <Button size="sm" variant="ghost" onClick={onExplain}>
                  {m.whyRetry}
                </Button>
              </div>
            )}
          </div>
        </Stack>
      </Card>
    </li>
  );
}

function LevelTwoPreview({ level, kinds }: { level: 1 | 2; kinds: NextMovesVM['level2Kinds'] }) {
  const l2 = t.moves.level2;
  return (
    <Card tone="muted" data-testid="level-2" data-locked={level < 2 ? 'true' : 'false'}>
      <div className="flex flex-wrap items-center gap-sm">
        <h3 className="font-semibold">{l2.title}</h3>
        <span className="rounded-full border border-border px-sm text-xs text-text-muted">{l2.preview}</span>
      </div>
      <p className="mt-xs text-sm text-text-muted">{level < 2 ? l2.locked : l2.unlocked}</p>
      <ul className="mt-sm flex flex-col gap-xs text-sm text-text-muted">
        {kinds.map((kind) => (
          <li key={kind} className="flex items-center gap-sm">
            <LockIcon />
            {moveTitle({ kind })}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
