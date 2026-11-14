// S6 About you + your starting month (JF2, JF3): age, take-home pay and the household (adults, kids
// by age, bedrooms, car, ZIP), then the starting month built from those answers for the person's area,
// preselected: one white card (house cutout by household shape, decorative only), the household as the
// headline, the metro, a big "$X / month", and the cost lines with sources under "Costs & sources".
// The orange CTA starts from it. When the spending came from a statement, the starting month is
// skipped and only "About you" is asked.
import type { InputHTMLAttributes } from 'react';
import { common, ladder } from '@/copy';
import {
  Art, BarBreakdown, Button, Card, Choice, cx, EstimateTag, Field, formatMoney, NumberInput, Stack, Sticker, Tag,
  useFieldControl, type ArtName,
} from '@/ui-kit';
import type { AboutYouVM, ClosestLifeVM, LadderProgressVM, LifeCandidateVM } from '../model/types';
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

const KID_AGES = ['infant', 'toddler', 'preschool', 'schoolAge'] as const;

export function ClosestLife({ vm, progress }: ClosestLifeProps) {
  const { candidate } = vm;
  const chosen = candidate !== null && candidate.cardId === vm.chosenCardId;
  // Starting from the built month is this screen's action; with a statement there is nothing to start from.
  const primary = vm.spendingFromStatement || chosen ? undefined : candidate ? (
    <Button size="lg" onClick={vm.choose}>
      {t.start}
    </Button>
  ) : (
    <Button size="lg" disabled>
      {ladder.shell.cta.S6}
    </Button>
  );
  return (
    <LadderShell screen="S6" progress={progress} loading={vm.status === 'loading'} primary={primary}>
      <AboutYou vm={vm} />
      {vm.spendingFromStatement ? (
        <p className="text-sm text-text-muted">{t.statementSkip}</p>
      ) : (
        candidate && (
          <section aria-label={t.yourLife} className="flex flex-col gap-md">
            <h2 className="font-display text-2xl font-extrabold leading-tight">{t.yourLife}</h2>
            <p className="text-sm text-text-muted">{t.yourLifeNote}</p>
            <div className="grid grid-cols-1 gap-xl sm:grid-cols-2 lg:grid-cols-3">
              <Candidate candidate={candidate} art={artFor(candidate)} chosen={chosen} onChoose={vm.choose} />
            </div>
          </section>
        )
      )}
      {chosen && (
        <p className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
          <EstimateTag />
          {t.chosenNote}
        </p>
      )}
    </LadderShell>
  );
}

/** A single-line ZIP box that picks up its label, hint and error from the surrounding <Field>. */
function ZipInput({
  value,
  onValueChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { value: string; onValueChange: (v: string) => void }) {
  const field = useFieldControl();
  return (
    <input
      {...field}
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="postal-code"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cx(
        'w-full rounded-lg border-2 bg-surface px-md py-sm text-base tabular-nums',
        field['aria-invalid'] ? 'border-negative' : 'border-border',
      )}
    />
  );
}

function AboutYou({ vm }: { vm: ClosestLifeVM }) {
  const a: AboutYouVM = vm.about;
  const ta = t.about;
  const zipError = a.zipStatus === 'invalid' ? ta.zipErrors.invalid : a.zipStatus === 'none' ? ta.zipErrors.none : undefined;
  const zipHint = a.zipStatus === 'nearby' && a.areaZip ? `${ta.zipHint} ${ta.zipNearby(a.areaZip)}` : ta.zipHint;
  return (
    <Card title={ta.title} headingLevel={2}>
      <Stack gap="xl">
        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
          <Field label={ta.age} isEstimate={a.age.isEstimate} hint={a.age.isEstimate ? ta.estimateHint : undefined}>
            <NumberInput
              value={a.age.value}
              min={a.age.bounds.min}
              max={a.age.bounds.max}
              maxFractionDigits={0}
              suffix={ta.yearsSuffix}
              onValueChange={(v) => {
                if (v !== null) vm.setAge(v);
              }}
            />
          </Field>
          <Field label={ta.pay} isEstimate={a.takeHomePay.isEstimate} hint={a.takeHomePay.isEstimate ? `${ta.payHint} ${ta.estimateHint}` : ta.payHint}>
            <NumberInput
              value={a.takeHomePay.value}
              min={a.takeHomePay.bounds.min}
              max={a.takeHomePay.bounds.max}
              maxFractionDigits={0}
              prefix="$"
              suffix={ta.paySuffix}
              onValueChange={(v) => {
                if (v !== null) vm.setTakeHomePay(v);
              }}
            />
          </Field>
        </div>

        <Stack gap="lg" as="fieldset" className="min-w-0 border-0 p-0">
          <legend className="mb-sm text-sm font-semibold">{ta.homeTitle}</legend>
          <Field label={ta.zip} hint={zipHint} error={zipError}>
            <ZipInput value={a.zip} onValueChange={vm.setZip} placeholder={ta.zipPlaceholder} maxLength={5} />
          </Field>
          <Choice
            legend={ta.adults}
            name="about-adults"
            value={String(a.adults)}
            options={[{ value: '1', label: '1' }, { value: '2', label: '2' }]}
            onChange={(v) => vm.setAdults(Number(v))}
          />
          <fieldset className="flex min-w-0 flex-col gap-sm">
            <legend className="mb-sm text-sm text-text-muted">{ta.kidsTitle}</legend>
            <div className="grid grid-cols-2 gap-md">
              {KID_AGES.map((age) => (
                <Field key={age} label={ta.kidAges[age]}>
                  <NumberInput
                    value={a.kids[age]}
                    onValueChange={(v) => vm.setKidCount(age, v ?? 0)}
                    min={0}
                    max={a.kidsPerBandMax}
                    maxFractionDigits={0}
                  />
                </Field>
              ))}
            </div>
          </fieldset>
          <Choice
            legend={ta.bedrooms}
            name="about-bedrooms"
            value={String(a.bedrooms)}
            options={ta.bedroomOptions.map((label, n) => ({ value: String(n), label }))}
            onChange={(v) => vm.setBedrooms(Number(v))}
          />
          <Choice
            legend={ta.car}
            name="about-car"
            value={a.hasCar ? 'yes' : 'no'}
            options={[{ value: 'yes', label: ta.carOptions.yes }, { value: 'no', label: ta.carOptions.no }]}
            onChange={(v) => vm.setHasCar(v === 'yes')}
          />
        </Stack>
      </Stack>
    </Card>
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
      aria-label={`${c.metro}: ${c.caption || t.yourLife}`}
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
          aria-label={t.chooseLabel(c.metro, c.caption || t.yourLife)}
          aria-pressed={chosen}
          className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        />
      )}
      {chosen ? (
        <Sticker tilt={-6} className="absolute top-lg right-lg z-10 text-sm">
          {t.chosen}
        </Sticker>
      ) : (
        <Tag className="absolute top-lg right-lg bg-surface-strong">{t.yours}</Tag>
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
            {c.caption && <p className="text-xs text-text-muted">{c.caption}</p>}
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
