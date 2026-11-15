// Chapter 2, "Do you know what you spend?": first the gut guess (the game's log slider, a giant orange
// number, the empty plot where the house will stand), then one compact step for the ZIP and the
// household (with age and pay optional, shown as "e.g." placeholders until typed). The CTA waits for
// a ZIP we have data for and says why next to it. All values and setters come from the ladder's
// view-models (useGuessYourself, useClosestLife).
import { useId, useState, type InputHTMLAttributes } from 'react';
import { ladder, onboarding } from '@/copy';
import {
  Art, Button, Choice, cx, EstimateTag, Field, formatMoney, formatRate, NumberInput, Slider, Sticker, useFieldControl,
} from '@/ui-kit';
import type { ClosestLifeVM, GuessYourselfVM, Rate } from '../model/types';

const t = onboarding.guess;
const ta = ladder.closest.about;
const KID_BANDS = ['infant', 'toddler', 'preschool', 'schoolAge'] as const;

export type ChapterGuessProps = {
  guess: GuessYourselfVM;
  closest: ClosestLifeVM;
  practiceError: Rate | null;
  onDone: () => void;
};

export function ChapterGuess({ guess, closest, practiceError, onDone }: ChapterGuessProps) {
  const [step, setStep] = useState<'guess' | 'home'>('guess');
  if (step === 'guess') {
    return (
      <GuessStep
        vm={guess}
        practiceError={practiceError}
        onLock={() => {
          guess.submit();
          setStep('home');
        }}
        onSkip={() => setStep('home')}
      />
    );
  }
  return <HomeStep vm={closest} onBack={() => setStep('guess')} onDone={onDone} />;
}

function GuessStep({ vm, practiceError, onLock, onSkip }: { vm: GuessYourselfVM; practiceError: Rate | null; onLock: () => void; onSkip: () => void }) {
  return (
    <div className="grid items-center gap-xl lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" data-testid="guess-step">
      <div className="flex min-w-0 flex-col gap-lg">
        <p className="text-lg text-text-muted">{t.lead}</p>
        {practiceError !== null && (
          <Sticker tone="ink" tilt={-2} className="self-start text-sm">
            {t.bridge(formatRate(practiceError, 0))}
          </Sticker>
        )}
        <p aria-hidden="true" className="flex flex-wrap items-baseline gap-x-md">
          <span className="font-display text-[length:calc(var(--text-display)*1.5)] font-extrabold leading-display tracking-tight text-primary tabular-nums lg:text-[length:calc(var(--text-display)*2.2)]">
            {formatMoney(vm.guess.value)}
          </span>
          <span className="text-2xl text-text-muted">{ladder.guess.aMonth}</span>
        </p>
        <Slider
          label={ladder.guess.sliderLabel}
          value={vm.guess.value}
          min={vm.guess.min}
          max={vm.guess.max}
          step={vm.guess.step}
          scale="log"
          formatValue={(v) => formatMoney(v)}
          onValueChange={vm.setGuess}
        />
        <div className="flex flex-col-reverse items-stretch gap-md pt-sm sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onSkip} className="min-h-11 text-left text-base font-semibold hover:text-primary">
            {t.skip}
          </button>
          <Button size="lg" onClick={onLock} disabled={vm.status !== 'ready'} className="ob-press">
            {t.lock}
          </Button>
        </div>
      </div>
      <div className="ob-build relative mx-auto flex w-full max-w-(--container-sm) flex-col items-center" aria-hidden="true">
        <Art name="empty-plot" className="w-full" loading="eager" />
        <Sticker tilt={-4} className="-mt-xl text-sm">
          {t.sticker}
        </Sticker>
      </div>
    </div>
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
        'w-full rounded-lg border-2 bg-surface px-md py-sm font-display text-2xl font-extrabold tabular-nums',
        field['aria-invalid'] ? 'border-negative' : 'border-border',
      )}
    />
  );
}

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-sm rounded-lg bg-bg px-sm py-xs">
      <span className="min-w-0 text-sm">{label}</span>
      <span className="flex items-center gap-xs">
        <button
          type="button"
          aria-label={t.kidMinus(label)}
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
          className="ob-press flex size-11 items-center justify-center rounded-full bg-surface text-xl font-bold shadow-sm disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center font-bold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={t.kidPlus(label)}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="ob-press flex size-11 items-center justify-center rounded-full bg-surface text-xl font-bold shadow-sm disabled:opacity-40"
        >
          +
        </button>
      </span>
    </div>
  );
}

function HomeStep({ vm, onBack, onDone }: { vm: ClosestLifeVM; onBack: () => void; onDone: () => void }) {
  const a = vm.about;
  const waitId = useId();
  const zipError = a.zipStatus === 'invalid' ? ta.zipErrors.invalid : a.zipStatus === 'none' ? ta.zipErrors.none : undefined;
  const zipHint = a.zipStatus === 'nearby' && a.areaZip ? `${ta.zipHint} ${ta.zipNearby(a.areaZip)}` : ta.zipHint;
  const canGo = vm.status === 'ready' && (vm.spendingFromStatement || vm.candidate !== null);
  const go = () => {
    if (!vm.spendingFromStatement) vm.choose();
    onDone();
  };
  return (
    <div className="grid items-start gap-xl lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" data-testid="home-step">
      <div className="ob-enter flex min-w-0 flex-col gap-lg rounded-xl bg-surface p-lg shadow-md sm:p-xl">
        <div className="flex flex-col gap-xs">
          <h2 className="font-display text-2xl font-extrabold">{t.homeTitle}</h2>
          <p className="text-sm text-text-muted">{t.homeLead}</p>
        </div>
        <Field label={ta.zip} hint={zipHint} error={zipError}>
          <ZipInput value={a.zip} onValueChange={vm.setZip} placeholder={ta.zipPlaceholder} maxLength={5} />
        </Field>
        <Choice
          legend={ta.adults}
          name="story-adults"
          value={String(a.adults)}
          options={[{ value: '1', label: '1' }, { value: '2', label: '2' }]}
          onChange={(v) => vm.setAdults(Number(v))}
        />
        <fieldset className="flex min-w-0 flex-col gap-sm">
          <legend className="mb-sm text-sm text-text-muted">{t.kidsTitle}</legend>
          <div className="grid grid-cols-1 gap-xs sm:grid-cols-2">
            {KID_BANDS.map((band) => (
              <Stepper key={band} label={ta.kidAges[band]} value={a.kids[band]} max={a.kidsPerBandMax} onChange={(n) => vm.setKidCount(band, n)} />
            ))}
          </div>
        </fieldset>
        <Choice
          legend={ta.bedrooms}
          name="story-bedrooms"
          value={String(a.bedrooms)}
          options={ta.bedroomOptions.map((label, n) => ({ value: String(n), label }))}
          onChange={(v) => vm.setBedrooms(Number(v))}
        />
        <Choice
          legend={ta.car}
          name="story-car"
          value={a.hasCar ? 'yes' : 'no'}
          options={[{ value: 'yes', label: ta.carOptions.yes }, { value: 'no', label: ta.carOptions.no }]}
          onChange={(v) => vm.setHasCar(v === 'yes')}
        />
        <details className="rounded-lg bg-bg px-md py-sm">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">{t.aboutMore}</summary>
          <div className="flex flex-col gap-md pt-sm">
            {(a.age.isEstimate || a.takeHomePay.isEstimate) && (
              <p className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
                <EstimateTag />
                {ta.estimateNote}
              </p>
            )}
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
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
          </div>
        </details>
        {vm.spendingFromStatement && <p className="text-sm text-text-muted">{t.statementNote}</p>}
        <div className="flex flex-col-reverse items-stretch gap-md sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onBack} className="min-h-11 text-left text-base font-semibold hover:text-primary">
            {onboarding.story.back}
          </button>
          <div className="flex flex-col items-stretch gap-xs sm:items-end">
            <Button size="lg" onClick={go} disabled={!canGo} aria-describedby={canGo ? undefined : waitId} className="ob-press">
              {t.next}
            </Button>
            {!canGo && vm.status === 'ready' && (
              <p id={waitId} data-testid="zip-needed" className="text-sm text-text-muted">
                {a.zipStatus === 'empty' || a.zipStatus === 'invalid' ? ta.zipNeeded : ta.zipNeededData}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="ob-build mx-auto hidden w-full max-w-(--container-sm) lg:block" aria-hidden="true">
        <Art name="house-blueprint" className="w-full" loading="eager" />
      </div>
    </div>
  );
}
