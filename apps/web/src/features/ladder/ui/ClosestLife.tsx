// S6 Closest life: pick one of today's lives (or a sample life) as the starting profile. Each card
// shows its typical month from the engine, the cost lines with sources, and why it is listed.
import { common, ladder } from '@/copy';
import { BarBreakdown, Button, Card, EstimateTag, formatMoney, Row, Stack, Stat } from '@/ui-kit';
import type { ClosestLifeVM, LadderProgressVM, LifeCandidateVM } from '../model/types';
import { LadderShell } from './LadderShell';

const t = ladder.closest;

export type ClosestLifeProps = { vm: ClosestLifeVM; progress: LadderProgressVM };

export function ClosestLife({ vm, progress }: ClosestLifeProps) {
  return (
    <LadderShell screen="S6" progress={progress} loading={vm.status === 'loading'}>
      <p className="text-sm text-text-muted">
        {vm.selfGuess !== null ? t.sortedByGuess(formatMoney(vm.selfGuess)) : t.unsorted}
      </p>
      <ul aria-label={t.listLabel} className="flex flex-col gap-lg">
        {vm.candidates.map((c) => (
          <li key={c.cardId}>
            <Candidate candidate={c} chosen={c.cardId === vm.chosenCardId} onChoose={() => vm.choose(c.cardId)} />
          </li>
        ))}
      </ul>
    </LadderShell>
  );
}

function Badge({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'positive' | 'primary' }) {
  const color =
    tone === 'positive'
      ? 'border-positive text-positive'
      : tone === 'primary'
        ? 'border-primary text-primary'
        : 'border-border text-text-muted';
  return <span className={`inline-flex rounded-full border px-sm text-xs font-medium ${color}`}>{children}</span>;
}

function Candidate({ candidate: c, chosen, onChoose }: { candidate: LifeCandidateVM; chosen: boolean; onChoose: () => void }) {
  return (
    <Card
      as="article"
      aria-label={`${c.metro}: ${c.caption}`}
      data-card-id={c.cardId}
      data-chosen={chosen ? 'true' : 'false'}
      className={chosen ? 'outline-2 outline-primary' : undefined}
    >
      <Stack gap="md">
        <Row gap="sm">
          <Badge>{c.fromToday ? t.fromToday : t.sample}</Badge>
          {c.isNearest && <Badge tone="primary">{t.nearest}</Badge>}
          {chosen && <Badge tone="positive">{t.chosen}</Badge>}
        </Row>
        <div className="flex flex-col gap-xs">
          <h2 className="text-lg font-semibold leading-tight">{c.metro}</h2>
          <p className="text-base">{c.caption}</p>
          <p className="text-sm text-text-muted">
            {t.household(c.adults, c.kids, c.bedrooms)} · {c.carPrice !== null ? t.car(formatMoney(c.carPrice)) : t.noCar}
          </p>
        </div>

        {c.available ? (
          <>
            <Stat
              label={t.monthlyLabel}
              value={formatMoney(c.monthly.mid)}
              hint={t.monthlyRange(formatMoney(c.monthly.low), formatMoney(c.monthly.high))}
            />
            <details className="rounded-md bg-surface px-md py-sm">
              <summary className="cursor-pointer text-sm font-medium">{t.costsToggle}</summary>
              <BarBreakdown
                className="mt-md"
                label={t.costsLabel(c.metro)}
                items={c.items.map((i) => ({
                  id: i.id,
                  label: common.categories[i.category],
                  amount: i.amount,
                  isEstimate: i.isEstimate,
                  source: i.source,
                }))}
                total={c.monthly.mid}
              />
            </details>
            <Row gap="md">
              <Button
                variant={chosen ? 'secondary' : 'primary'}
                onClick={onChoose}
                aria-label={t.chooseLabel(c.metro, c.caption)}
                aria-pressed={chosen}
              >
                {t.choose}
              </Button>
            </Row>
            {chosen && (
              <p className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
                <EstimateTag />
                {t.chosenNote}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-text-muted">{t.unavailable}</p>
        )}
      </Stack>
    </Card>
  );
}
