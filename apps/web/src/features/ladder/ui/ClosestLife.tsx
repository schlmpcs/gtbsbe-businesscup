// S6 Closest life (Figma S06): pick one of today's lives (or a sample life) as the starting profile.
// Life tiles in a 3-column grid (illustration, city, one line, "≈ $X a month"); the chosen one gets
// an orange border and a "That's me" sticker. Each tile keeps its cost lines with sources one tap away.
import { common, ladder } from '@/copy';
import { Art, BarBreakdown, Card, cx, EstimateTag, formatMoney, Sticker, type ArtName } from '@/ui-kit';
import type { ClosestLifeVM, LadderProgressVM, LifeCandidateVM } from '../model/types';
import { LadderShell } from './LadderShell';

const t = ladder.closest;

/** Decorative house illustrations (never data): matched by city name when one fits, else by position. */
const CITY_ART: readonly ArtName[] = ['austin', 'brooklyn', 'boise', 'tampa', 'queens', 'columbus'];
function artFor(metro: string, index: number): ArtName {
  const name = metro.toLowerCase();
  return CITY_ART.find((a) => name.includes(a)) ?? CITY_ART[index % CITY_ART.length]!;
}

/** Small decorative tilts, as in the frame. */
const TILTS = [-1.2, 0.8, -0.6, 1, -1, 0.6] as const;

export type ClosestLifeProps = { vm: ClosestLifeVM; progress: LadderProgressVM };

export function ClosestLife({ vm, progress }: ClosestLifeProps) {
  const chosen = vm.candidates.find((c) => c.cardId === vm.chosenCardId);
  return (
    <LadderShell screen="S6" progress={progress} loading={vm.status === 'loading'} centered>
      {vm.selfGuess !== null && (
        <p className="text-center text-sm text-text-muted">{t.sortedByGuess(formatMoney(vm.selfGuess))}</p>
      )}
      <ul aria-label={t.listLabel} className="grid grid-cols-1 gap-xl pt-sm sm:grid-cols-2 lg:grid-cols-3">
        {vm.candidates.map((c, i) => (
          <li key={c.cardId} className="min-w-0">
            <Candidate
              candidate={c}
              art={artFor(c.metro, i)}
              tilt={TILTS[i % TILTS.length]!}
              chosen={c.cardId === vm.chosenCardId}
              onChoose={() => vm.choose(c.cardId)}
            />
          </li>
        ))}
      </ul>
      {chosen && (
        <p className="flex flex-wrap items-center justify-center gap-sm text-center text-sm text-text-muted">
          <EstimateTag />
          {t.chosenNote}
        </p>
      )}
    </LadderShell>
  );
}

function Candidate({
  candidate: c,
  art,
  tilt,
  chosen,
  onChoose,
}: {
  candidate: LifeCandidateVM;
  art: ArtName;
  tilt: number;
  chosen: boolean;
  onChoose: () => void;
}) {
  return (
    <Card
      as="article"
      aria-label={`${c.metro}: ${c.caption}`}
      data-card-id={c.cardId}
      data-chosen={chosen ? 'true' : 'false'}
      style={{ transform: `rotate(${tilt}deg)` }}
      className={cx(
        'relative flex h-full flex-col gap-md border-3 transition-shadow',
        chosen ? 'border-primary shadow-lg' : 'border-transparent hover:shadow-lg',
        !c.available && 'opacity-60',
      )}
    >
      {c.available && (
        // The whole tile is the "start from this life" button (stretched over it).
        <button
          type="button"
          onClick={onChoose}
          aria-label={t.chooseLabel(c.metro, c.caption)}
          aria-pressed={chosen}
          className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        />
      )}
      {chosen && (
        <Sticker tilt={-6} className="absolute -top-md right-lg text-sm">
          {t.chosen}
        </Sticker>
      )}

      <div className="flex items-center gap-lg">
        <Art name={art} className="w-2/5 shrink-0" imgClassName="aspect-square" />
        <div className="flex min-w-0 flex-col gap-xs">
          <span className="text-xs font-medium text-text-muted">
            {c.fromToday ? t.fromToday : t.sample}
            {c.isNearest && <span className="text-primary"> · {t.nearest}</span>}
          </span>
          <h2 className="font-display text-2xl font-extrabold leading-tight">{c.metro}</h2>
          <p className="text-sm text-text-muted">{c.caption}</p>
          {c.available ? (
            <p className={cx('text-base font-bold tabular-nums', chosen && 'text-primary')}>
              {t.perMonth(formatMoney(c.monthly.mid))}
            </p>
          ) : (
            <p className="text-sm text-text-muted">{t.unavailable}</p>
          )}
        </div>
      </div>

      {c.available && (
        <details className="relative z-10 mt-auto rounded-md bg-bg px-md py-sm">
          <summary className="cursor-pointer text-xs font-medium text-text-muted">{t.costsToggle}</summary>
          <div className="mt-md flex flex-col gap-sm">
            <p className="text-xs text-text-muted">
              {t.household(c.adults, c.kids, c.bedrooms)} ·{' '}
              {c.carPrice !== null ? t.car(formatMoney(c.carPrice)) : t.noCar}
            </p>
            <p className="text-xs text-text-muted tabular-nums">
              {t.monthlyRange(formatMoney(c.monthly.low), formatMoney(c.monthly.high))}
            </p>
            <BarBreakdown
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
          </div>
        </details>
      )}
    </Card>
  );
}
