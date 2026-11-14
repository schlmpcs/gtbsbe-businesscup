// S6 Closest life (Design v3, Figma 202:1931): pick one of today's lives (or a sample life) as the
// starting profile. White cards in a grid, built to scan: a house cutout (picked by household shape,
// decorative only, never the same picture on two neighbouring cards), the household as the headline
// ("1 adult · studio"), the metro as one muted line, a big "$X / month". The chosen card gets an
// orange inset border and a "That's me" sticker; the others a small source tag. The full household,
// the car, the range and the cost lines with sources sit under "Costs & sources". The orange CTA
// ("Start from this life →") is disabled until a life is picked.
import { common, ladder } from '@/copy';
import { Art, BarBreakdown, Button, cx, EstimateTag, formatMoney, Sticker, Tag, type ArtName } from '@/ui-kit';
import type { ClosestLifeVM, LadderProgressVM, LifeCandidateVM } from '../model/types';
import { LadderShell } from './LadderShell';

const t = ladder.closest;

const HOME_ART = ['home-apartment', 'home-suburb', 'home-family', 'home-large'] as const satisfies readonly ArtName[];

/** Decorative house cutout by household shape (never data). */
function artFor(c: Pick<LifeCandidateVM, 'kids' | 'bedrooms'>): ArtName {
  if (c.bedrooms >= 4) return 'home-large';
  if (c.kids.length > 0) return 'home-family';
  return c.bedrooms <= 1 ? 'home-apartment' : 'home-suburb';
}

/**
 * One picture per card, in list order. When the household rule gives a card the same picture as the
 * card before it, rotate through the other home pictures by the card's index so neighbours differ.
 */
export function artsFor(candidates: readonly Pick<LifeCandidateVM, 'kids' | 'bedrooms'>[]): ArtName[] {
  const arts: ArtName[] = [];
  candidates.forEach((c, i) => {
    const prev = arts[i - 1];
    let art: ArtName = artFor(c);
    for (let k = 0; art === prev && k < HOME_ART.length; k++) art = HOME_ART[(i + k) % HOME_ART.length]!;
    arts.push(art);
  });
  return arts;
}

export type ClosestLifeProps = { vm: ClosestLifeVM; progress: LadderProgressVM };

export function ClosestLife({ vm, progress }: ClosestLifeProps) {
  const chosen = vm.candidates.find((c) => c.cardId === vm.chosenCardId);
  const arts = artsFor(vm.candidates);
  return (
    <LadderShell
      screen="S6"
      progress={progress}
      loading={vm.status === 'loading'}
      // Picking a card is this screen's action: the CTA waits for it.
      primary={
        chosen ? undefined : (
          <Button size="lg" disabled>
            {ladder.shell.cta.S6}
          </Button>
        )
      }
    >
      {vm.selfGuess !== null && (
        <p className="-mt-md text-sm text-text-muted">{t.sortedByGuess(formatMoney(vm.selfGuess))}</p>
      )}
      <ul aria-label={t.listLabel} className="grid grid-cols-1 gap-xl pt-sm sm:grid-cols-2 lg:grid-cols-3">
        {vm.candidates.map((c, i) => (
          <li key={c.cardId} className="min-w-0">
            <Candidate
              candidate={c}
              art={arts[i]!}
              chosen={c.cardId === vm.chosenCardId}
              onChoose={() => vm.choose(c.cardId)}
            />
          </li>
        ))}
      </ul>
      {chosen && (
        <p className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
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
  chosen,
  onChoose,
}: {
  candidate: LifeCandidateVM;
  art: ArtName;
  chosen: boolean;
  onChoose: () => void;
}) {
  return (
    <article
      aria-label={`${c.metro}: ${c.caption}`}
      data-card-id={c.cardId}
      data-chosen={chosen ? 'true' : 'false'}
      className={cx(
        'relative flex h-full flex-col gap-md rounded-xl bg-surface p-xl shadow-md transition-shadow',
        chosen ? 'shadow-lg ring-4 ring-primary ring-inset' : 'hover:shadow-lg',
        !c.available && 'opacity-60',
      )}
    >
      {c.available && (
        // The whole card is the "start from this life" button (stretched over it).
        <button
          type="button"
          onClick={onChoose}
          aria-label={t.chooseLabel(c.metro, c.caption)}
          aria-pressed={chosen}
          className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        />
      )}
      {chosen ? (
        <Sticker tilt={-6} className="absolute top-lg right-lg z-10 text-sm">
          {t.chosen}
        </Sticker>
      ) : (
        <Tag className="absolute top-lg right-lg bg-surface-strong">
          {c.fromToday ? t.fromToday : t.sample}
          {c.isNearest && ` · ${t.nearest}`}
        </Tag>
      )}

      <Art name={art} className="mx-auto w-4/5 pt-lg" imgClassName="aspect-square" />

      <div className="flex min-w-0 flex-col gap-xs">
        <h2 className="font-display text-2xl font-extrabold leading-tight">
          {t.headline(c.adults, c.kids.length, c.bedrooms)}
        </h2>
        <p className="text-sm text-text-muted">{c.metro}</p>
        {c.available ? (
          <p className="flex flex-wrap items-baseline gap-x-sm">
            <span
              className={cx(
                'font-display text-4xl font-extrabold leading-display tabular-nums',
                chosen && 'text-primary',
              )}
            >
              {formatMoney(c.monthly.mid)}
            </span>
            <span className="text-sm text-text-muted">{t.perMonthSuffix}</span>
          </p>
        ) : (
          <p className="text-sm text-text-muted">{t.unavailable}</p>
        )}
      </div>

      {c.available && (
        <details className="relative z-10 mt-auto rounded-md bg-bg px-md py-sm">
          <summary className="cursor-pointer text-xs font-medium text-text-muted">{t.costsToggle}</summary>
          <div className="mt-md flex flex-col gap-sm">
            <p className="text-xs text-text-muted">{c.caption}</p>
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
    </article>
  );
}
