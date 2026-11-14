// S5 Guess yourself (Figma S05): a huge orange guess over one log-scale slider for your own monthly
// cost and a big "lock in" button, today's game results in the black score bar, then your guess
// next to the engine's estimate for the current profile.
import { ladder } from '@/copy';
import { Button, Card, cx, EstimateTag, formatMoney, formatRate, Scoreboard, Slider } from '@/ui-kit';
import type { GuessYourselfVM, LadderProgressVM, SelfGuessComparisonVM } from '../model/types';
import { LadderShell } from './LadderShell';

const t = ladder.guess;

export type GuessYourselfProps = { vm: GuessYourselfVM; progress: LadderProgressVM };

export function GuessYourself({ vm, progress }: GuessYourselfProps) {
  const { guess, savedGuess, bridge, comparison } = vm;
  const isSaved = savedGuess !== null && savedGuess === guess.value;

  return (
    <LadderShell screen="S5" progress={progress} loading={vm.status === 'loading'} centered>
      <div className="mx-auto flex w-full max-w-(--container-2xl) flex-col items-stretch gap-xl">
        <p aria-hidden="true" className="flex flex-wrap items-baseline justify-center gap-x-md text-center">
          <span className="font-display text-display font-extrabold leading-display text-primary tabular-nums">
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
        <Button size="lg" fullWidth onClick={vm.submit} disabled={isSaved}>
          {savedGuess === null ? t.submit : t.update}
        </Button>
        {isSaved && (
          <span role="status" className="text-center text-sm font-medium text-positive">
            {t.saved}
          </span>
        )}
      </div>

      {bridge && (
        <Scoreboard
          label={t.bridgeLabel}
          items={[
            { id: 'low', value: t.bridgeOf(bridge.guessedLow, bridge.played), label: t.bridgeLow(bridge.played), tone: 'primary' },
            { id: 'high', value: t.bridgeOf(bridge.guessedHigh, bridge.played), label: t.bridgeHigh(bridge.played) },
          ]}
        />
      )}

      {comparison && <Comparison comparison={comparison} />}
    </LadderShell>
  );
}

function Comparison({ comparison: c }: { comparison: SelfGuessComparisonVM }) {
  const amount = formatMoney(Math.abs(c.difference));
  const share = formatRate(Math.abs(c.differenceShare), 0);
  const verdict = c.direction === 'match' ? t.exact : c.direction === 'above' ? t.above(amount, share) : t.below(amount, share);
  return (
    <Card title={t.compareTitle} style={{ transform: 'rotate(-0.5deg)' }}>
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
            'w-fit rounded-lg px-lg py-sm text-base font-bold text-on-primary',
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
