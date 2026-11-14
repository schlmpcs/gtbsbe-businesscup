'use client';

// S21 Little things (design preview): guess → see it → keep or cut, all three steps on one page.
import { useState } from 'react';
import { previewB as c } from '@/copy';
import { Button, Card, EstimateTag, SourceNote, Slider, Stack, cx, formatMoney } from '@/ui-kit';
import type { HabitRowVM, LittleThingsVM, SubscriptionRowVM } from '../model/types';
import { Pill, RowList, Segmented, ToolShell } from './shared';

export type LittleThingsStep = 'guess' | 'reveal' | 'decide';
const t = c.subs;
const STEPS = [
  { value: 'guess', label: t.steps.guess },
  { value: 'reveal', label: t.steps.reveal },
  { value: 'decide', label: t.steps.decide },
] as const;

export function LittleThings({ vm, initialStep = 'guess' }: { vm: LittleThingsVM; initialStep?: LittleThingsStep }) {
  const [step, setStep] = useState<LittleThingsStep>(initialStep);
  const [guess, setGuess] = useState(vm.guess.initial);
  return (
    <ToolShell id="S21" title={t.title} intro={t.intro}>
      <Segmented label={t.stepsLabel} value={step} options={STEPS} onChange={setStep} size="md" className="max-w-full overflow-x-auto" />
      {step === 'guess' && <GuessStep vm={vm} guess={guess} setGuess={setGuess} onShow={() => setStep('reveal')} />}
      {step === 'reveal' && <RevealStep vm={vm} guess={guess} onNext={() => setStep('decide')} />}
      {step === 'decide' && <DecideStep vm={vm} />}
    </ToolShell>
  );
}

function GuessStep({ vm, guess, setGuess, onShow }: { vm: LittleThingsVM; guess: number; setGuess: (n: number) => void; onShow: () => void }) {
  return (
    <Card>
      <Stack gap="xl">
        <h2 className="font-display text-3xl font-extrabold leading-tight">{t.guessQuestion}</h2>
        <p className="font-display text-display leading-display font-extrabold tabular-nums">
          {formatMoney(guess)}
          <span className="text-2xl text-text-muted">{c.perMonth}</span>
        </p>
        <Slider
          label={t.guessLabel}
          value={guess}
          onValueChange={setGuess}
          min={vm.guess.min}
          max={vm.guess.max}
          step={vm.guess.step}
          formatValue={(n) => formatMoney(n)}
          hint={t.guessHint}
        />
        <Button size="lg" fullWidth onClick={onShow}>
          {t.showReal}
        </Button>
      </Stack>
    </Card>
  );
}

function RevealStep({ vm, guess, onNext }: { vm: LittleThingsVM; guess: number; onNext: () => void }) {
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no' | undefined>>({});
  return (
    <Stack gap="lg">
      <Card tone="arena">
        <Stack gap="md">
          <h2 className="font-display text-4xl font-extrabold leading-tight">{t.revealHeadline(formatMoney(guess), formatMoney(vm.actual))}</h2>
          <p className="text-base text-text-muted">{t.revealSub}</p>
        </Stack>
      </Card>
      <Card tone="muted">
        <p className="text-sm text-text">{t.survey(formatMoney(vm.survey.guessed), formatMoney(vm.survey.paid))}</p>
      </Card>

      <Card title={t.findHeading}>
        <Stack gap="sm">
          <Button fullWidth>{t.upload}</Button>
          <Button variant="secondary" fullWidth>
            {t.trySample}
          </Button>
          <Button variant="ghost" fullWidth>
            {t.pickByTapping}
          </Button>
          <p className="text-xs text-text-muted">{t.privacy}</p>
        </Stack>
      </Card>

      <Card title={t.maybeHeading}>
        <p className="text-sm text-text-muted">{t.maybeHint}</p>
        <RowList label={t.maybeHeading}>
          {vm.maybe.map((m) => {
            const a = answers[m.id];
            return (
              <li key={m.id} className="flex flex-col gap-sm py-md sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-sm break-words">{m.label}</p>
                  <p className="text-xs text-text-muted">
                    {formatMoney(m.amount, { cents: true })}
                    {c.perMonth} · {t.seen(m.months)}
                  </p>
                </div>
                {a ? (
                  <div className="flex items-center gap-sm">
                    <Pill tone={a === 'yes' ? 'positive' : 'muted'}>{a === 'yes' ? t.confirmed : t.dismissed}</Pill>
                    <Button variant="ghost" size="sm" onClick={() => setAnswers((s) => ({ ...s, [m.id]: undefined }))}>
                      ↺
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-sm">
                    <Button size="sm" variant="dark" onClick={() => setAnswers((s) => ({ ...s, [m.id]: 'yes' }))}>
                      {t.yes}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setAnswers((s) => ({ ...s, [m.id]: 'no' }))}>
                      {t.no}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </RowList>
      </Card>

      <Button size="lg" variant="dark" fullWidth onClick={onNext}>
        {t.nextToDecide}
      </Button>
    </Stack>
  );
}

function DecideStep({ vm }: { vm: LittleThingsVM }) {
  return (
    <Stack gap="lg">
      <p className="text-base text-text-muted">{t.decideIntro}</p>
      <Card title={t.subsHeading}>
        <RowList label={t.subsHeading}>
          {vm.subscriptions.map((s) => (
            <SubRow key={s.id} row={s} />
          ))}
        </RowList>
      </Card>
      <Card title={t.habitsHeading}>
        <RowList label={t.habitsHeading}>
          {vm.habits.map((h) => (
            <HabitRow key={h.id} row={h} />
          ))}
        </RowList>
      </Card>

      <Card tone="arena">
        <Stack gap="md">
          <p className="font-display text-3xl font-extrabold leading-tight">{t.summary(vm.summary.count, formatMoney(vm.summary.tenYear))}</p>
          <p className="text-lg font-semibold">{t.summaryGoal(vm.summary.goalWeeks)}</p>
          <div className="flex flex-col gap-sm sm:flex-row">
            <Button variant="dark" size="lg" fullWidth>
              {t.addMoves}
            </Button>
          </div>
        </Stack>
      </Card>
      <Button variant="secondary" fullWidth>
        {t.ics}
      </Button>
      <p className="text-xs text-text-muted">{t.tenYearNote}</p>
    </Stack>
  );
}

function RowMeta({ tenYear, goalDays, cut }: { tenYear: number; goalDays: number; cut: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-xs">
      <span className={cx('text-sm font-semibold tabular-nums', cut ? 'text-text' : 'text-text-muted')}>{t.tenYears(formatMoney(tenYear))}</span>
      <Pill tone={cut ? 'positive' : 'muted'}>{t.goalDays(goalDays)}</Pill>
    </div>
  );
}

function SubRow({ row }: { row: SubscriptionRowVM }) {
  const [choice, setChoice] = useState(row.initial);
  return (
    <li className="flex flex-col gap-sm py-md">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <p className="font-semibold">{row.name}</p>
          <p className="flex flex-wrap items-center gap-xs text-sm text-text-muted tabular-nums">
            {formatMoney(row.price, { cents: true })}
            {row.cadence === 'yearly' ? c.perYear : c.perMonth}
            {row.isEstimate && <EstimateTag />}
          </p>
        </div>
        <Segmented
          label={row.name}
          value={choice}
          onChange={setChoice}
          options={[
            { value: 'keep', label: t.keep },
            { value: 'cut', label: t.cut },
          ]}
        />
      </div>
      <RowMeta tenYear={row.tenYear} goalDays={row.goalDays} cut={choice === 'cut'} />
      <SourceNote source={row.source} variant="toggle" />
    </li>
  );
}

function HabitRow({ row }: { row: HabitRowVM }) {
  const [choice, setChoice] = useState(row.initial);
  return (
    <li className="flex flex-col gap-sm py-md">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <p className="font-semibold">{row.name}</p>
          <p className="flex flex-wrap items-center gap-xs text-sm text-text-muted">
            {t.habitLine(row.perWeek, formatMoney(row.price))}
            {row.isEstimate && <EstimateTag />}
          </p>
        </div>
        <Segmented
          label={row.name}
          value={choice}
          onChange={setChoice}
          options={[
            { value: 'keep', label: t.keep },
            { value: 'half', label: t.half },
            { value: 'cut', label: t.cut },
          ]}
        />
      </div>
      <RowMeta tenYear={row.tenYear} goalDays={row.goalDays} cut={choice !== 'keep'} />
    </li>
  );
}
