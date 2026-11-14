// S5 Guess yourself (Design v3, Figma 202:1873): headline and sub on the left, a giant orange guess
// over one log-scale slider for your own monthly cost, today's game result as a tilted ink sticker,
// and the empty plot on the right ("we build your house from your real month"). Only the gut guess: the
// orange CTA locks it and goes on to the next step in one tap; coming back, the slider is the guess and
// the CTA leads on. Guess vs reality shows only once the spending is the user's own.
import { ladder } from '@/copy';
import { Art, buttonClassName, Card, formatMoney, Slider, Sticker } from '@/ui-kit';
import type { GuessYourselfVM, LadderProgressVM, SelfGuessRevealVM } from '../model/types';
import { LadderShell } from './LadderShell';

const t = ladder.guess;

export type GuessYourselfProps = { vm: GuessYourselfVM; progress: LadderProgressVM };

export function GuessYourself({ vm, progress }: GuessYourselfProps) {
  const { guess, savedGuess, bridge, reveal } = vm;

  // Before the first save, locking the guess is the one orange CTA (skipping is the text action): it
  // saves the guess and goes on to the next rung in one tap. After it, the CTA just leads on (the
  // shell's default).
  const step = progress.rungs.findIndex((r) => r.screen === 'S5');
  const nextHref = progress.rungs[step + 1]?.href ?? progress.futureHref;
  const lock = (
    <a href={nextHref} onClick={vm.submit} className={buttonClassName({ size: 'lg' })}>
      {t.submit}
    </a>
  );

  return (
    <LadderShell
      screen="S5"
      progress={progress}
      loading={vm.status === 'loading'}
      primary={savedGuess === null ? lock : undefined}
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

      {reveal && <Reveal reveal={reveal} />}
    </LadderShell>
  );
}

function Reveal({ reveal: r }: { reveal: SelfGuessRevealVM }) {
  const gap = formatMoney(Math.abs(r.difference));
  const verdict = Math.abs(r.difference) < 1 ? t.revealExact : r.difference > 0 ? t.revealMore(gap) : t.revealLess(gap);
  return (
    <Card title={t.revealTitle}>
      <div className="flex flex-col gap-sm" data-testid="guess-reveal">
        <p className="text-lg font-semibold">{t.reveal(formatMoney(r.guess), formatMoney(r.actual))}</p>
        <p className="text-sm text-text-muted">{verdict}</p>
      </div>
    </Card>
  );
}
