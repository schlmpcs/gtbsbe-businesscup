// S5 Guess yourself: one log-scale slider for your own monthly cost, then your guess next to the
// engine's estimate for the current profile.
import { ladder } from '@/copy';
import { Button, Card, formatMoney, formatRate, Row, Slider, Stack, Stat } from '@/ui-kit';
import type { GuessYourselfVM, LadderProgressVM, SelfGuessComparisonVM } from '../model/types';
import { LadderShell } from './LadderShell';

const t = ladder.guess;

export type GuessYourselfProps = { vm: GuessYourselfVM; progress: LadderProgressVM };

export function GuessYourself({ vm, progress }: GuessYourselfProps) {
  const { guess, savedGuess, bridge, comparison } = vm;
  const isSaved = savedGuess !== null && savedGuess === guess.value;

  return (
    <LadderShell screen="S5" progress={progress} loading={vm.status === 'loading'}>
      <Card>
        <Stack gap="lg">
          <p className="text-sm text-text-muted">
            {bridge ? t.bridge(bridge.guessedLow, bridge.played) : t.bridgeNone}
          </p>
          <Slider
            label={t.sliderLabel}
            value={guess.value}
            min={guess.min}
            max={guess.max}
            step={guess.step}
            scale="log"
            formatValue={(v) => formatMoney(v)}
            hint={t.sliderHint}
            onValueChange={vm.setGuess}
          />
          <Row gap="md">
            <Button onClick={vm.submit} disabled={isSaved}>
              {savedGuess === null ? t.submit : t.update}
            </Button>
            {isSaved && (
              <span role="status" className="text-sm font-medium text-positive">
                {t.saved}
              </span>
            )}
          </Row>
        </Stack>
      </Card>

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
      <Stack gap="md">
        <Row gap="xl" align="start">
          <Stat label={t.yourGuess} value={formatMoney(c.guess)} hint={t.perMonth} />
          <Stat label={t.ourEstimate} value={formatMoney(c.estimate)} hint={t.perMonth} isEstimate={c.isEstimate} />
        </Row>
        <p className="text-base font-medium" data-testid="guess-verdict">
          {verdict}
        </p>
        <p className="text-sm text-text-muted">{t.basis[c.basis]}</p>
      </Stack>
    </Card>
  );
}
