// The household view: month, fair split, "Us in 10 years" and the shared goal. Presentational:
// every number arrives computed in TogetherResultVM.
import { goal as goalCopy, together as t } from '@/copy';
import { Card, Money, Stack, Stat, Sticker, Tag, formatMoney, formatRate } from '@/ui-kit';
import type { TogetherResultVM } from '../model/types';

export function ResultView({ result, names }: { result: TogetherResultVM; names: { p1: string | null; p2: string | null } }) {
  const a = t.label(names.p1, 1);
  const b = t.label(names.p2, 2);
  const { month, split, future, goal } = result;
  const short = month.surplus < 0;
  return (
    <Stack gap="xl" data-testid="together-result">
      <Card title={t.result.monthTitle} headingLevel={2} data-testid="together-month">
        <Stack gap="lg">
          <div className="grid gap-lg sm:grid-cols-3">
            <Stat label={t.result.takeHome} value={<Money value={month.takeHome} />} />
            <Stat label={t.result.spending} value={<Money value={month.spending + month.debtPayments} />} hint={`${t.result.debtPayments}: ${formatMoney(month.debtPayments)}`} />
            <Stat
              label={short ? t.result.shortfall : t.result.surplus}
              value={<Money value={Math.abs(month.surplus)} />}
              tone={short ? 'negative' : 'positive'}
              isEstimate={month.isEstimate}
              size="lg"
            />
          </div>
          <div>
            <h3 className="mb-xs text-sm font-semibold text-text-muted">{t.result.perPartner}</h3>
            <ul className="flex flex-col gap-xs text-sm">
              {result.partners.map((p, i) => (
                <li key={i}>{t.plan.partnerTotals(t.label(p.label, i === 0 ? 1 : 2), formatMoney(p.takeHome), formatMoney(p.spending + p.debtPayments))}</li>
              ))}
            </ul>
          </div>
        </Stack>
      </Card>

      <Card title={t.result.splitTitle} headingLevel={2} data-testid="together-split">
        <Stack gap="lg">
          <p className="text-sm text-text-muted">{t.result.splitLead}</p>
          <p className="font-display text-3xl font-extrabold leading-tight" data-testid="together-split-line">
            {t.result.splitLine(a, formatMoney(split.p1), b, formatMoney(split.p2))}
          </p>
          <p className="text-sm">
            {split.basis === 'even' ? t.result.splitEvenBasis : t.result.splitShare(a, formatRate(split.p1Share, 0))}
          </p>
          <div className="grid gap-lg sm:grid-cols-2">
            <Stat label={t.result.sharedTotal} value={<Money value={split.total} />} isEstimate={split.isEstimate} />
            <Stat label={t.result.evenTitle} value={t.result.evenLine(formatMoney(split.evenEach))} />
          </div>
          {split.basis === 'income' && Math.round(split.p1VsEven) !== 0 && (
            <p className="text-sm" data-testid="together-vs-even">
              {t.result.vsEven(a, formatMoney(Math.abs(split.p1VsEven)), split.p1VsEven > 0)}
            </p>
          )}
        </Stack>
      </Card>

      <Card
        title={t.result.futureTitle}
        headingLevel={2}
        data-testid="together-future"
        action={
          <Tag variant="dashed" title={t.result.rulesWhy}>
            {t.result.rulesTag}
            <span className="sr-only">: {t.result.rulesWhy}</span>
          </Tag>
        }
      >
        <Stack gap="lg">
          <p className="text-sm text-text-muted">{t.result.futureLead}</p>
          <div className="grid gap-lg sm:grid-cols-2">
            <Stat label={t.result.futureToday} value={<Money value={future.today} />} />
            <Stat label={t.result.futureMid} value={<Money value={future.mid} />} isEstimate={future.isEstimate} size="lg" />
          </div>
          {future.isEstimate && <p className="text-sm">{t.result.futureRange(formatMoney(future.low), formatMoney(future.high))}</p>}
        </Stack>
      </Card>

      <Card title={t.result.goalTitle} headingLevel={2} data-testid="together-goal">
        {goal ? (
          <Stack gap="md">
            <div className="flex flex-wrap items-center gap-md">
              <p className="text-lg font-semibold">{t.result.goalLine(formatMoney(goal.target), goal.years)}</p>
              <Sticker tone={goal.verdict === 'onTrack' ? 'positive' : goal.verdict === 'behind' ? 'ink' : 'soft'}>
                {goalCopy.verdictLabel[goal.verdict]}
              </Sticker>
            </div>
            <p className="text-sm text-text-muted">{goalCopy.verdict[goal.verdict]}</p>
            <div className="grid gap-lg sm:grid-cols-2">
              <Stat label={t.result.goalProjected} value={<Money value={goal.projectedMid} />} />
              {goal.gap > 0 && <Stat label={t.result.goalGap} value={<Money value={goal.gap} />} />}
            </div>
          </Stack>
        ) : (
          <p className="text-sm text-text-muted">{t.result.goalNone}</p>
        )}
      </Card>

      <p className="text-xs text-text-muted">{t.result.disclaimer}</p>
    </Stack>
  );
}
