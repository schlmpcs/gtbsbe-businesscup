// S6 About you + your starting month (JF2, JF3): age, take-home pay and the household (adults, kids
// by age, bedrooms, car, ZIP), then the starting month built from those answers for the person's area,
// preselected (JF13): one white card with a house cutout that matches the household (studio, 1-bed
// apartment, family house, with or without a car; decorative only), the household as the headline, the
// metro, a big "$X / month", 1–2 chips that explain the price, and the cost lines with sources under
// "Costs & sources". The orange CTA starts from it in one tap; until there is a ZIP we have data for it
// waits, and says why next to it. When the spending came from a statement, the starting month is
// skipped and only "About you" is asked. Age and pay are asked here only: an empty box shows our typical
// value as a grey "e.g." placeholder, with one estimate tag for the block (never a value that looks typed).
import { useId, type InputHTMLAttributes } from 'react';
import { common, ladder } from '@/copy';
import {
  Art, BarBreakdown, Button, buttonClassName, Card, Choice, cx, EstimateTag, Field, formatMoney, NumberInput, Stack, Sticker, Tag,
  useFieldControl, type ArtName,
} from '@/ui-kit';
import type { AboutYouVM, ClosestLifeVM, DifferentiatorVM, LadderProgressVM, LifeCandidateVM } from '../model/types';
import { LadderShell } from './LadderShell';

const t = ladder.closest;

/**
 * Decorative house cutout that matches the household facts (never data): a studio or a 1-bed
 * apartment, a family house with kids, a bigger house for 4 bedrooms, with or without a car.
 */
export function artFor(c: Pick<LifeCandidateVM, 'kids' | 'bedrooms' | 'carPrice'>): ArtName {
  const car = c.carPrice !== null;
  if (c.bedrooms >= 4) return 'home-large';
  if (c.kids.length > 0) return car ? 'home-family' : 'home-cottage';
  if (c.bedrooms === 0) return car ? 'home-apartment' : 'home-studio';
  if (c.bedrooms === 1) return car ? 'home-apartment' : 'home-apartment-nocar';
  return car ? 'home-suburb' : 'home-cottage';
}

function chipText(d: DifferentiatorVM): string {
  const c = t.differentiator;
  switch (d.kind) {
    case 'car':
      return c.car(formatMoney(d.amount));
    case 'noCar':
      return c.noCar;
    case 'childcare':
      return c.childcare(formatMoney(d.amount));
    case 'pricierArea':
      return c.pricierArea(formatMoney(d.amount));
    case 'cheaperArea':
      return c.cheaperArea(formatMoney(d.amount));
  }
}

export type ClosestLifeProps = { vm: ClosestLifeVM; progress: LadderProgressVM };

const KID_AGES = ['infant', 'toddler', 'preschool', 'schoolAge'] as const;

export function ClosestLife({ vm, progress }: ClosestLifeProps) {
  const { candidate } = vm;
  const chosen = candidate !== null && candidate.cardId === vm.chosenCardId;
  const step = progress.rungs.findIndex((r) => r.screen === 'S6');
  const nextHref = progress.rungs[step + 1]?.href ?? progress.futureHref;
  // The built month is preselected: the CTA starts from it (and saves it) in one tap. With a statement
  // there is nothing to start from, so the CTA just leads on.
  const waitId = useId();
  const primary = vm.spendingFromStatement || chosen ? undefined : vm.selectedCardId ? (
    <a href={nextHref} onClick={vm.choose} className={buttonClassName({ size: 'lg' })}>
      {ladder.shell.cta.S6}
    </a>
  ) : (
    // Disabled until a ZIP we have data for: the reason sits right next to it.
    <div className="flex flex-col items-stretch gap-xs sm:items-end">
      <Button size="lg" disabled aria-describedby={waitId}>
        {ladder.shell.cta.S6}
      </Button>
      <p id={waitId} data-testid="zip-needed" className="text-sm text-text-muted">
        {vm.about.zipStatus === 'empty' || vm.about.zipStatus === 'invalid' ? t.about.zipNeeded : t.about.zipNeededData}
      </p>
    </div>
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
              <Candidate
                candidate={candidate}
                art={artFor(candidate)}
                chosen={candidate.cardId === vm.selectedCardId}
                onChoose={vm.choose}
              />
            </div>
            <p className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
              <EstimateTag />
              {chosen ? t.chosenNote : t.preselectedNote}
            </p>
          </section>
        )
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
  const anyEstimate = a.age.isEstimate || a.takeHomePay.isEstimate;
  return (
    <Card title={ta.title} headingLevel={2}>
      <Stack gap="xl">
        {/* One estimate tag for the block (not one per box): its sr-only text explains it once. */}
        {anyEstimate && (
          <p className="flex flex-wrap items-center gap-sm text-sm text-text-muted" data-testid="about-estimates">
            <EstimateTag />
            {ta.estimateNote}
          </p>
        )}
        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
          <Field label={ta.age}>
            <NumberInput
              value={a.age.value}
              placeholder={ta.estimatePlaceholder(String(a.age.estimate))}
              min={a.age.bounds.min}
              max={a.age.bounds.max}
              maxFractionDigits={0}
              suffix={ta.yearsSuffix}
              onValueChange={(v) => {
                if (v !== null) vm.setAge(v);
              }}
            />
          </Field>
          <Field label={ta.pay} hint={ta.payHint}>
            <NumberInput
              value={a.takeHomePay.value}
              placeholder={ta.estimatePlaceholder(Math.round(a.takeHomePay.estimate).toLocaleString('en-US'))}
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
        {c.differentiators.length > 0 && (
          <ul aria-label={t.differentiatorsLabel} className="flex flex-wrap gap-xs pt-xs">
            {c.differentiators.map((d) => (
              <li key={d.kind}>
                <Tag className="bg-bg">{chipText(d)}</Tag>
              </li>
            ))}
          </ul>
        )}
      </div>

      {c.available && (
        <details className="relative z-10 mt-auto rounded-md bg-bg px-md py-sm">
          <summary className="cursor-pointer text-xs font-medium text-text-muted">{t.costsToggle}</summary>
          <div className="mt-md flex flex-col gap-sm">
            {c.caption && <p className="text-xs text-text-muted">{c.caption}</p>}
            <p className="text-xs text-text-muted">
              {t.household(c.adults, c.kids, c.bedrooms)} ·{' '}
              {c.carPrice === null ? t.noCar : c.carPrice > 0 ? t.car(formatMoney(c.carPrice)) : t.carNoLoan}
            </p>
            <p className="text-xs text-text-muted tabular-nums">
              {t.monthlyRange(formatMoney(c.monthly.low), formatMoney(c.monthly.high))}
            </p>
            <BarBreakdown
              label={t.costsLabel(c.metro)}
              // Every line of a built month is a typical value for the area: the one estimate tag under the
              // card says so for all of them, so the lines carry their sources, not a tag each.
              items={c.items.map((i) => ({
                id: i.id,
                label: common.categories[i.category],
                amount: i.amount,
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
