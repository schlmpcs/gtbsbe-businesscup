// Next Moves (usePlanMoves): ranked cards, the dollar effect at retirement big, in the order the hook
// gives; then "Check a decision": the What if? tools (/afford, /loan, /decide) as illustrated tiles and a
// link to all of them (/tools). The route passes its Link component in.
import type { ComponentType, ReactNode } from 'react';
import { plan as copy } from '@/copy';
import { Button, Tag, ToolTile, cx } from '@/ui-kit';
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

      <div className="flex flex-col gap-md pt-sm">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-sm">
          <h3 className="section-label">{d.title}</h3>
          <Link
            href={d.all.href}
            className="inline-flex min-h-11 items-center gap-xs rounded-md px-sm text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            {d.all.label} <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ul className="grid grid-cols-1 gap-lg min-[480px]:grid-cols-3">
          {[d.afford, d.loan, d.decide].map((x, i) => (
            <li key={x.href}>
              <ToolTile href={x.href} art={x.art} tone={x.tone} title={x.title} line={x.body} size="md" index={i} Link={Link} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
