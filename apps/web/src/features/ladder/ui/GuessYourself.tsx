// S5 Guess yourself (Design v3, Figma 202:1873): headline and sub on the left, a giant orange guess
// over one log-scale slider for your own monthly cost, today's game result as a tilted ink sticker,
// and the empty plot on the right ("your house starts here"). The orange CTA locks the guess; once
// it is saved, the guess sits next to the engine's estimate and the CTA leads to the next rung.
import { ladder } from '@/copy';
import { Art, Button, Card, cx, EstimateTag, formatMoney, formatRate, Slider, Sticker } from '@/ui-kit';
import type { GuessYourselfVM, LadderProgressVM, SelfGuessComparisonVM } from '../model/types';
import { LadderShell, LadderTextButton } from './LadderShell';

const t = ladder.guess;

export type GuessYourselfProps = { vm: GuessYourselfVM; progress: LadderProgressVM };

export function GuessYourself({ vm, progress }: GuessYourselfProps) {
  const { guess, savedGuess, bridge, comparison } = vm;
  const isSaved = savedGuess !== null && savedGuess === guess.value;

  // Before the first save, locking the guess is the one orange CTA (skipping is the text action).
  // After it, the CTA goes on to the next rung (the shell's default) and changing the guess is the
  // text action on the left.
  const lock = (
    <Button size="lg" onClick={vm.submit}>
      {t.submit}
    </Button>
  );
  const update = (
    <div className="flex flex-wrap items-center gap-md">
      <LadderTextButton onClick={vm.submit} disabled={isSaved}>
        {t.update}
      </LadderTextButton>
      {isSaved && (
        <span role="status" className="text-sm font-semibold text-positive">
          {t.saved}
        </span>
      )}
    </div>
  );

  return (
    <LadderShell
      screen="S5"
      progress={progress}
      loading={vm.status === 'loading'}
      primary={savedGuess === null ? lock : undefined}
      secondary={savedGuess === null ? undefined : update}
      aside={
        <div className="relative flex flex-col items-center">
          <Art name="empty-plot" className="w-full max-w-(--container-md)" />
          <Sticker tilt={-4} className="-mt-xl text-sm">
            {t.plotSticker}
          </Sticker>
        </div>
      }
    >
      <div className="flex flex-col gap-lg">
        <p aria-hidden="true" className="flex flex-wrap items-baseline gap-x-md">
          <span className="font-display text-[length:calc(var(--text-display)*1.6)] font-extrabold leading-display tracking-tight text-primary tabular-nums lg:text-[length:calc(var(--text-display)*2.6)]">
            {formatMoney(guess.value)}
          </span>
          <span className="text-2xl text-text-muted">{t.aMonth}</span>
        </p>
        <Slider
          label={t.sliderLabel}
          value={guess.value}
          min={guess.min}
          max={guess.max}
          step={guess.step}
          scale="log"
          formatValue={(v) => formatMoney(v)}
          onValueChange={vm.setGuess}
        />
        {bridge && bridge.played > 0 && (
          <Sticker tone="ink" tilt={-2} className="text-sm">
            {bridge.guessedHigh > bridge.guessedLow
              ? t.bridgeHigh(bridge.guessedHigh, bridge.played)
              : t.bridgeLow(bridge.guessedLow, bridge.played)}
          </Sticker>
        )}
      </div>

      {comparison && <Comparison comparison={comparison} />}
    </LadderShell>
  );
}

function Comparison({ comparison: c }: { comparison: SelfGuessComparisonVM }) {
  const amount = formatMoney(Math.abs(c.difference));
  const share = formatRate(Math.abs(c.differenceShare), 0);
  const verdict = c.direction === 'match' ? t.exact : c.direction === 'above' ? t.above(amount, share) : t.below(amount, share);
  return (
    <Card title={t.compareTitle}>
      <div className="flex flex-col gap-lg">
        <div className="grid grid-cols-2 gap-xl">
          <div className="flex flex-col gap-xs">
            <span className="text-sm font-medium text-text-muted">{t.yourGuess}</span>
            <span className="font-display text-4xl font-extrabold leading-display tabular-nums">
              {formatMoney(c.guess)}
              <span className="text-base font-normal text-text-muted">{t.perMonth}</span>
            </span>
          </div>
          <div className="flex flex-col gap-xs">
            <span className="flex flex-wrap items-center gap-sm text-sm font-medium text-text-muted">
              {t.ourEstimate}
              {c.isEstimate && <EstimateTag />}
            </span>
            <span className="font-display text-4xl font-extrabold leading-display text-primary tabular-nums">
              {formatMoney(c.estimate)}
              <span className="text-base font-normal text-text-muted">{t.perMonth}</span>
            </span>
          </div>
        </div>
        <p
          data-testid="guess-verdict"
          style={{ transform: 'rotate(-1deg)' }}
          className={cx(
            'w-fit rounded-full px-lg py-sm text-base font-bold text-on-primary shadow-md',
            c.direction === 'match' ? 'bg-positive' : 'bg-ink',
          )}
        >
          {verdict}
        </p>
        <p className="text-xs text-text-muted">{t.basis[c.basis]}</p>
      </div>
    </Card>
  );
}
