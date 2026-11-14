'use client';

// Step 3: the guess against the total, like with like. From the ticks (catalogue prices) before a
// statement, from the statement after it. The survey figure is quoted with its source and said to be
// a survey, not the person's data. Tone is the same whether the guess was low or high.
import { subscriptions as t } from '@/copy';
import { Button, Card, formatMoney, Money, Row, SourceNote, Stack, Stat } from '@/ui-kit';
import type { SubscriptionsVM } from '../model/types';

export type RevealCardProps = { reveal: SubscriptionsVM['reveal']; onFindForgotten: () => void; onBack: () => void };

export function RevealCard({ reveal, onFindForgotten, onBack }: RevealCardProps) {
  const fromStatement = reveal.against === 'statement' && reveal.statement !== null;
  return (
    <Card title={t.reveal.title}>
      <Stack gap="lg">
        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
          <Stat
            label={t.reveal.guessed}
            value={reveal.guess === null ? '—' : <Money value={reveal.guess} />}
            hint={reveal.guess === null ? undefined : t.reveal.perMonth(formatMoney(reveal.guess))}
          />
          <Stat
            label={fromStatement ? t.reveal.fromStatement(reveal.statement!.monthsCovered) : t.reveal.fromTicks(reveal.ticks.priceYear)}
            value={<Money value={reveal.actual} cents />}
            isEstimate={!fromStatement}
            hint={
              <>
                {t.reveal.perMonth(formatMoney(reveal.actual, { cents: true }))} · {t.reveal.perYear(formatMoney(reveal.actualYearly, { cents: true }))}
                {!fromStatement && ` · ${t.reveal.ticked(reveal.ticks.count)}`}
              </>
            }
          />
        </div>

        <Stack gap="xs" aria-live="polite">
          {reveal.direction !== null && reveal.gap !== null && (
            <p className="text-base font-medium">
              {reveal.direction === 'lower'
                ? t.reveal.gap.lower(formatMoney(reveal.gap, { cents: true }))
                : reveal.direction === 'higher'
                  ? t.reveal.gap.higher(formatMoney(reveal.gap, { cents: true }))
                  : t.reveal.gap.close}
            </p>
          )}
          {reveal.missFactor !== null && reveal.miss !== null && (
            <p className="text-sm text-text-muted">
              {t.reveal.factor(reveal.missFactor.toFixed(2))} · {t.reveal.bucket[reveal.miss]}
            </p>
          )}
          {reveal.guess === null && <p className="text-sm text-text-muted">{t.reveal.noGuess}</p>}
          {reveal.guess !== null && reveal.actual === 0 && <p className="text-sm text-text-muted">{t.reveal.noTotal}</p>}
        </Stack>

        <div className="flex flex-col gap-xs rounded-lg bg-surface-strong p-lg">
          <p className="text-sm">{t.reveal.survey(formatMoney(reveal.survey.guessed), formatMoney(reveal.survey.itemized))}</p>
          <p className="text-xs font-medium text-text-muted">{t.reveal.surveyNote}</p>
          <SourceNote source={reveal.survey.source} />
        </div>

        {reveal.against === 'ticks' && <p className="text-sm text-text-muted">{t.reveal.forgot}</p>}
        <Row gap="sm">
          <Button size="lg" onClick={onFindForgotten}>
            {t.reveal.findOnes}
          </Button>
          <Button variant="ghost" onClick={onBack}>
            {t.reveal.backToTicks}
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
