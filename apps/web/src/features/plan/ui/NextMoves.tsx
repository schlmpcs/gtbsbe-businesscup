// Next Moves (usePlanMoves): ranked cards, the dollar effect at retirement big, in the order the hook
// gives; then "Check a decision" links to /afford and /loan. The route passes its Link component in.
import type { ComponentType, ReactNode } from 'react';
import { plan as copy } from '@/copy';
import { Button, Tag, cx } from '@/ui-kit';
import type { PlanMovesVM } from '../model/types';

export type PlanLinkComponent = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

function DefaultLink({ href, className, children }: { href: string; className?: string; children?: ReactNode }) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function NextMoves({ vm, Link = DefaultLink }: { vm: PlanMovesVM; Link?: PlanLinkComponent }) {
  const t = copy.screen.moves;
  const d = copy.screen.decisions;
  return (
    <section aria-labelledby="plan-moves" className="flex min-w-0 flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <h2 id="plan-moves" className="text-lg font-bold">{copy.moves.title}</h2>
        <p className="text-sm text-text-muted">{t.intro}</p>
      </div>
      {vm.moves.length === 0 ? (
        <p className="card card-pad text-sm text-text-muted">{t.empty}</p>
      ) : (
        <ol className="grid gap-md md:grid-cols-3">
          {vm.moves.map((m, i) => (
            <li
              key={m.id}
              data-move={m.id}
              className="card card-pad animate-enter flex flex-col gap-sm"
              style={{ ['--enter-delay' as string]: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-sm">
                <span aria-hidden="true" className="flex size-xl shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-on-primary">
                  {i + 1}
                </span>
                <span className="sr-only">{t.rank(i + 1)}</span>
                <span className="min-w-0 font-semibold leading-tight">{m.title}</span>
              </div>
              <p className="flex flex-wrap items-baseline gap-x-sm">
                <span className={cx('font-display text-3xl font-extrabold tabular-nums', m.tone === 'bad' ? 'text-negative' : 'text-positive')}>
                  {m.effectAtRetirement}
                </span>
                <span className="text-sm text-text-muted">{t.atRetirement}</span>
              </p>
              {m.successRateDelta !== null && <span className="text-sm text-text-muted">{m.successRateDelta}</span>}
              <p className="flex-1 text-sm">{m.explanation}</p>
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

      <div className="flex flex-col gap-sm pt-sm">
        <h3 className="section-label">{d.title}</h3>
        <ul className="grid gap-md sm:grid-cols-2">
          {[d.afford, d.loan].map((x) => (
            <li key={x.href}>
              <Link
                href={x.href}
                className="card flex min-h-11 items-center justify-between gap-md p-lg transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{x.title}</span>
                  <span className="text-sm text-text-muted">{x.body}</span>
                </span>
                <span aria-hidden="true" className="text-xl text-primary">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
