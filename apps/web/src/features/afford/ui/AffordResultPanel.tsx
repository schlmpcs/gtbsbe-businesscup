'use client';

import { afford as t, forecast } from '@/copy';
import { Art, Card, cx, ForecastChart, formatRate, Money, Stack, Sticker, Tag } from '@/ui-kit';
import type { ReactNode } from 'react';
import type { AffordResultVM, AffordRulesVM, AffordVM, PayWithChoice, VMError } from '../model/types';
import { Skeleton } from './controls';

const VERDICT_TONE: Record<AffordResultVM['verdict'], string> = {
  fits: 'text-positive',
  wait: 'text-text',
  no: 'text-text',
};

function failsOnText(failsOn: NonNullable<AffordResultVM['failsOn']>, rules: AffordRulesVM): string {
  switch (failsOn) {
    case 'cushion':
      return t.result.failsOn.cushion(t.result.cushionMonths(rules.cushionMonths));
    case 'debtLoad':
      return t.result.failsOn.debtLoad(formatRate(rules.debtLoadRed));
    case 'cardRevolves':
      return t.result.failsOn.cardRevolves;
  }
}

function errorText(error: VMError): string {
  return error.kind === 'notImplemented' ? t.result.errors.notImplemented : t.result.errors.other;
}

const STICKER_TONE = { fits: 'positive', wait: 'primary', no: 'ink' } as const;

/** Big display size for the verdict sentence (Figma S11: ~80px on desktop). */
const VERDICT_SIZE =
  'font-display text-4xl font-extrabold leading-display tracking-tight sm:text-display xl:text-[length:calc(var(--text-display)*1.4)]';

/** Headline verdict plus the plain-language reason; never blames the purchase for a plan that already breaks a rule. */
function Verdict({ data, rules }: { data: AffordResultVM; rules: AffordRulesVM }) {
  const headline =
    data.verdict === 'fits'
      ? t.result.verdicts.fits
      : data.verdict === 'wait'
        ? t.result.verdicts.wait(data.waitMonths ?? 0)
        : t.result.verdicts.no;
  const reason = data.failsOn ? failsOnText(data.failsOn, rules) : null;
  const body = 'max-w-prose text-lg text-text-muted';

  return (
    <Stack gap="md">
      <p data-testid="afford-verdict" data-verdict={data.verdict} className={cx(VERDICT_SIZE, VERDICT_TONE[data.verdict])}>
        {headline}
      </p>
      {data.verdict === 'fits' && data.baselineFails && (
        <p role="note" className="rounded-lg bg-bg p-md text-sm">
          {t.result.baseline.fits}
        </p>
      )}

      {data.verdict === 'wait' && (
        <>
          {data.baselineFails ? <p className={body}>{t.result.baseline.wait}</p> : reason && <p className={body}>{reason}</p>}
        </>
      )}

      {data.verdict === 'no' &&
        (data.baselineFails ? (
          <p className={body}>
            {t.result.baseline.no} {reason}
          </p>
        ) : (
          reason && <p className={body}>{reason}</p>
        ))}
    </Stack>
  );
}

/** Who made the with / without numbers ("Rules-based estimate"): S10 may show another number from the AI model. */
function SourceLabel({ source, className }: { source: AffordResultVM['forecastSource']; className?: string }) {
  return (
    <Tag data-testid="afford-forecast-source" className={className}>
      {forecast.source[source]}
    </Tag>
  );
}

/** A white fact card under the answer: a big number (or word) over a small label (Figma S11). */
function Fact({ value, label, note }: { value: ReactNode; label: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-xs rounded-xl bg-surface p-xl shadow-md">
      <dt className="order-2 text-sm text-text-muted">{label}</dt>
      <dd className="order-1 font-display text-3xl font-extrabold leading-tight tabular-nums sm:text-4xl">{value}</dd>
      {note && <dd className="order-3 text-xs font-semibold text-primary">{note}</dd>}
    </div>
  );
}

/**
 * The fact cards: net worth vs not buying in 1 and 10 years (rules engine, labeled) and the cheapest way
 * to pay. Every number comes from the view-model.
 */
function Facts({ data, chosenWay }: { data: AffordResultVM; chosenWay: PayWithChoice }) {
  const shown = data.horizons.filter((h) => h.month === 120 || h.month === 12).sort((a, b) => b.month - a.month);
  return (
    <div data-testid={data.horizons.length > 0 ? 'afford-horizons' : undefined} className="flex flex-col gap-sm">
      <dl aria-label={t.result.effectsLabel} className="grid grid-cols-1 gap-md sm:grid-cols-3">
        {shown.map((h) => (
          <Fact key={h.month} value={<Money value={h.deltaMid} signed />} label={t.result.effects[h.month]!} />
        ))}
        <Fact
          value={t.result.cheapestWays[data.cheapestWay]}
          label={t.result.cheapestTitle}
          note={data.cheapestWay === chosenWay ? t.result.cheapestSame : t.result.cheapestDifferent}
        />
      </dl>
      {data.horizons.length > 0 && <SourceLabel source={data.forecastSource} className="self-start" />}
    </div>
  );
}

/** Collapsed: the rules behind the verdict (and the wait, and the cheapest way). */
function HowWeDecide({ data }: { data: AffordResultVM }) {
  return (
    <details className="text-sm text-text-muted">
      <summary className="cursor-pointer font-medium">{t.result.howTitle}</summary>
      <div className="mt-sm flex flex-col gap-xs">
        <p>{t.result.how}</p>
        {data.verdict === 'wait' && data.waitMonths !== null && <p>{t.result.waitBody(data.waitMonths)}</p>}
        <p>{t.result.cheapestHint}</p>
      </div>
    </details>
  );
}

function Horizons({ data }: { data: AffordResultVM }) {
  const h = t.result.horizonHeaders;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t.result.horizonsCaption}</caption>
        <thead>
          <tr className="text-left text-xs text-text-muted">
            <th scope="col" className="py-xs pr-sm font-medium">{h.when}</th>
            <th scope="col" className="py-xs pr-sm text-right font-medium">{h.with}</th>
            <th scope="col" className="py-xs pr-sm text-right font-medium">{h.without}</th>
            <th scope="col" className="py-xs text-right font-medium">{h.delta}</th>
          </tr>
        </thead>
        <tbody>
          {data.horizons.map((row) => (
            <tr key={row.month} className="border-t border-border">
              <th scope="row" className="py-sm pr-sm text-left font-normal">{t.result.horizons[row.month]}</th>
              <td className="py-sm pr-sm text-right"><Money value={row.with.mid} compact /></td>
              <td className="py-sm pr-sm text-right"><Money value={row.without.mid} compact /></td>
              <td className={cx('py-sm text-right font-semibold', row.deltaMid < 0 ? 'text-negative' : 'text-text')}>
                <Money value={row.deltaMid} compact signed />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type AffordResultPanelProps = {
  result: AffordVM['result'];
  rules: AffordRulesVM;
  invalidFields: string[];
  /** The purchase name for the chart legend. */
  purchaseLabel: string;
  chosenWay: PayWithChoice;
};

/** The big white answer card: tilted verdict sticker, giant verdict sentence, reason, and the crane art. */
function AnswerCard({ sticker, children }: { sticker?: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-label={t.result.title}
      className="grid grid-cols-1 items-center gap-xl rounded-xl bg-surface p-xl shadow-md sm:p-2xl md:grid-cols-[3fr_2fr]"
    >
      <div className="flex min-w-0 flex-col items-start gap-lg">
        {sticker}
        {children}
      </div>
      <Art name="afford-crane" className="mx-auto w-1/2 max-w-(--container-3xs) md:w-full" />
    </section>
  );
}

/** The answer (Figma S11, right): the verdict card, then the fact cards. */
export function AffordVerdictTile({ result, rules, invalidFields, chosenWay }: Omit<AffordResultPanelProps, 'purchaseLabel'>) {
  if (result === null) {
    return (
      <AnswerCard>
        <p className="font-display text-3xl font-extrabold leading-tight text-text-muted sm:text-4xl">
          {invalidFields.length > 0 ? t.form.fixFields : t.form.empty}
        </p>
      </AnswerCard>
    );
  }
  if (result.status === 'loading') {
    return (
      <AnswerCard>
        <div className="w-full">
          <Skeleton label={t.result.loading} />
        </div>
      </AnswerCard>
    );
  }
  if (result.status === 'error') {
    return (
      <AnswerCard>
        <p role="alert" className="text-lg">
          {errorText(result.error)}
        </p>
      </AnswerCard>
    );
  }

  const data = result.data;
  return (
    <div className="flex flex-col gap-lg" aria-live="polite">
      <AnswerCard
        sticker={
          <Sticker tone={STICKER_TONE[data.verdict]} tilt={-4} className="px-lg! py-sm! text-base! shadow-md">
            {t.result.stickers[data.verdict]}
          </Sticker>
        }
      >
        <Verdict data={data} rules={rules} />
        <HowWeDecide data={data} />
      </AnswerCard>
      <Facts data={data} chosenWay={chosenWay} />
    </div>
  );
}

/** The with / without chart and, collapsed, the table behind it (rules engine, labeled). */
export function AffordEffects({ result, purchaseLabel }: Pick<AffordResultPanelProps, 'result' | 'purchaseLabel'>) {
  if (result?.status !== 'ready') return null;
  const data = result.data;
  return (
    <Card data-testid="afford-chart">
      <SourceLabel source={data.forecastSource} className="mb-sm" />
      <ForecastChart
        title={t.result.chartTitle(purchaseLabel)}
        series={{ label: t.result.chartWith(purchaseLabel), points: data.withPoints }}
        compare={{ label: t.result.chartWithout, points: data.withoutPoints }}
        footnote={t.result.chartFootnote}
      />
      {data.horizons.length > 0 && (
        <details className="mt-md">
          <summary className="cursor-pointer text-sm font-medium text-text-muted">{t.result.horizonsTitle}</summary>
          <div className="mt-sm">
            <Horizons data={data} />
          </div>
        </details>
      )}
    </Card>
  );
}

/** Answer plus the chart, stacked (the screen places the two parts separately). */
export function AffordResultPanel(props: AffordResultPanelProps) {
  return (
    <Stack gap="lg">
      <AffordVerdictTile {...props} />
      <AffordEffects result={props.result} purchaseLabel={props.purchaseLabel} />
    </Stack>
  );
}
