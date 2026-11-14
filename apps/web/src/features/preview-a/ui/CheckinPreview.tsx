'use client';

// S14 Monthly check-in, real version (design preview). Spec: docs/design/USER-JOURNEY.md → S14.
// Sample numbers; buttons switch local state only.
import { useState } from 'react';
import { previewA } from '@/copy';
import { Button, buttonClassName, Card, cx, formatMoney, formatRate, Money } from '@/ui-kit';
import type { CheckinMonth, CheckinPreviewProps, CheckinRow } from '../model/types';
import { Pill, PreviewHeader, PreviewMain, PreviewStates, PreviewStatus, ProgressBar } from './shared';

const t = previewA.checkin;

function Delta({ row }: { row: Pick<CheckinRow, 'forecast' | 'actual'> }) {
  const d = row.actual - row.forecast;
  if (Math.abs(d) < 0.5) return <span className="text-text-muted">{t.even}</span>;
  // Over forecast is neutral gray (not red); under is green.
  return d > 0 ? (
    <span className="text-text-muted">{t.over(formatMoney(d))}</span>
  ) : (
    <span className="font-semibold text-positive">{t.under(formatMoney(-d))}</span>
  );
}

function CompareBars({ month }: { month: CheckinMonth }) {
  const max = Math.max(...month.rows.flatMap((r) => [r.forecast, r.actual]));
  const w = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <Card title={t.compareTitle} data-testid="checkin-compare">
      <div className="mb-md flex flex-wrap gap-lg text-xs text-text-muted" aria-hidden="true">
        <span className="flex items-center gap-xs">
          <span className="inline-block size-md rounded-full bg-chart-6" /> {t.forecast}
        </span>
        <span className="flex items-center gap-xs">
          <span className="inline-block size-md rounded-full bg-primary" /> {t.actual}
        </span>
      </div>
      <ul aria-label={t.compareLabel(month.monthLabel)} className="flex flex-col gap-lg">
        {month.rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-x-md text-sm">
              <span className="font-semibold">{r.label}</span>
              <span className="tabular-nums">
                <Money value={r.actual} /> <span className="text-text-muted">/ {formatMoney(r.forecast)}</span>
              </span>
            </div>
            <div aria-hidden="true" className="flex flex-col gap-[2px]">
              <div className="h-sm rounded-full bg-chart-6" style={{ width: w(r.forecast) }} />
              <div className="h-sm rounded-full bg-primary" style={{ width: w(r.actual) }} />
            </div>
            <span className="text-xs">
              <Delta row={r} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-lg flex flex-wrap items-baseline justify-between gap-md border-t border-border pt-md">
        <span className="text-sm font-medium">{t.total}</span>
        <span className="flex flex-col items-end">
          <span className="text-lg font-semibold tabular-nums">
            <Money value={month.actualTotal} /> <span className="text-sm text-text-muted">/ {formatMoney(month.forecastTotal)}</span>
          </span>
          <span className="text-xs">
            <Delta row={{ forecast: month.forecastTotal, actual: month.actualTotal }} />
          </span>
        </span>
      </div>
    </Card>
  );
}

function ProgressCard({
  title,
  name,
  line,
  share,
  pace,
  testId,
}: {
  title: string;
  name: string;
  line: string;
  share: number;
  pace: string;
  testId: string;
}) {
  return (
    <Card title={title} data-testid={testId} className="flex flex-col">
      <div className="flex flex-col gap-sm">
        <p className="text-lg font-bold">{name}</p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-md">
          <span className="font-semibold tabular-nums">{line}</span>
          <span className="font-display text-2xl font-extrabold text-positive tabular-nums">{formatRate(share, 0)}</span>
        </div>
        <ProgressBar share={share} label={t.progressLabel(name)} />
        <p className="text-sm text-text-muted">{pace}</p>
      </div>
    </Card>
  );
}

type Mode = 'pro' | 'free';

export function CheckinPreview({ currentMonthLabel, months }: CheckinPreviewProps) {
  const [mode, setMode] = useState<Mode>('pro');
  const [index, setIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [icsPressed, setIcsPressed] = useState(false);
  const month = index === null ? null : months[index];
  const canForward = index === null || index < months.length - 1;
  // Before the first fast-forward, the move and goal show where the first sample month starts.
  const shown = month ?? months[0]!;

  const forward = () => {
    setIndex((i) => (i === null ? 0 : Math.min(months.length - 1, i + 1)));
    setSaved(false);
  };

  return (
    <PreviewMain>
      <PreviewStates
        options={[
          { id: 'pro', label: t.states.pro },
          { id: 'free', label: t.states.free },
        ]}
        value={mode}
        onChange={setMode}
      />
      <PreviewHeader
        eyebrow={t.eyebrow(month?.monthLabel ?? currentMonthLabel)}
        title={t.title}
        intro={t.intro}
      />

      <div className="flex flex-col gap-sm">
        <Button size="lg" onClick={forward} disabled={!canForward} className="w-full sm:w-fit">
          {index === null ? t.fastForward : t.fastForwardAgain}
        </Button>
        <p className="text-sm text-text-muted">{t.fastForwardHint}</p>
      </div>

      {month ? (
        <>
          <div className="flex flex-wrap items-center gap-sm" data-testid="simulated-month">
            <Pill tone="ink">{month.monthLabel}</Pill>
            <Pill tone="outline">{t.simulatedTag}</Pill>
          </div>
          <CompareBars month={month} />
        </>
      ) : (
        <Card tone="muted" className="flex flex-col gap-xs border-2 border-dashed border-border" data-testid="checkin-empty">
          <h2 className="text-xl font-bold leading-tight">{t.emptyTitle}</h2>
          <p className="text-sm text-text-muted">{t.emptyBody}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-xl sm:grid-cols-2">
        <ProgressCard
          testId="checkin-move"
          title={t.moveTitle}
          name={shown.move.name}
          line={t.moveOf(formatMoney(shown.move.paid), formatMoney(shown.move.total))}
          share={shown.move.share}
          pace={t.movePace(shown.move.payoffLabel)}
        />
        <ProgressCard
          testId="checkin-goal"
          title={t.goalTitle}
          name={shown.goal.name}
          line={t.goalOf(formatMoney(shown.goal.saved), formatMoney(shown.goal.target))}
          share={shown.goal.share}
          pace={t.goalPace(shown.goal.paceLabel)}
        />
      </div>

      {month && (
        <Card tone="arena" data-testid="checkin-value" className="flex flex-col gap-sm">
          <h2 className="text-xl font-bold leading-tight">{t.valueTitle}</h2>
          <p className="font-display text-3xl font-extrabold leading-tight tabular-nums">
            {t.valueBody(formatMoney(month.value.paidDown), formatMoney(month.value.vsForecast, { signed: true }))}
          </p>
          <p className="text-sm text-text-muted">{t.valueHint}</p>
        </Card>
      )}

      {mode === 'free' && (
        <Card className="flex flex-col gap-md border-2 border-primary" data-testid="checkin-paywall">
          <h2 className="text-2xl font-extrabold leading-tight">{t.paywallTitle}</h2>
          <p className="text-text-muted">{t.paywallBody}</p>
          <a href="/pro" className={cx(buttonClassName({ size: 'lg' }), 'w-full sm:w-fit')}>
            {t.paywallCta}
          </a>
        </Card>
      )}
      <div className="flex flex-col gap-sm sm:flex-row">
        {mode === 'pro' && (
          <Button size="lg" variant="dark" onClick={() => setSaved(true)} disabled={!month || saved} className="sm:flex-1">
            {t.save}
          </Button>
        )}
        <Button size="lg" variant="secondary" onClick={() => setIcsPressed(true)} className="sm:flex-1">
          {t.ics}
        </Button>
      </div>
      <PreviewStatus>{saved ? `${t.saved} ${previewA.noAction}` : icsPressed ? previewA.noAction : null}</PreviewStatus>
    </PreviewMain>
  );
}
