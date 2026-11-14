'use client';

import { afford as t, forecast } from '@/copy';
import { Card, cx, ForecastChart, formatRate, Money, Stack, Stat, Tag } from '@/ui-kit';
import type { AffordResultVM, AffordRulesVM, AffordVM, PayWithChoice, VMError } from '../model/types';
import { Skeleton } from './controls';

const VERDICT_TONE: Record<AffordResultVM['verdict'], string> = {
  fits: 'text-positive',
  wait: 'text-warning',
  no: 'text-negative',
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

/** Headline verdict plus the plain-language reason; never blames the purchase for a plan that already breaks a rule. */
function Verdict({ data, rules }: { data: AffordResultVM; rules: AffordRulesVM }) {
  const headline =
    data.verdict === 'fits'
      ? t.result.verdicts.fits
      : data.verdict === 'wait'
        ? t.result.verdicts.wait(data.waitMonths ?? 0)
        : t.result.verdicts.no;
  const reason = data.failsOn ? failsOnText(data.failsOn, rules) : null;

  return (
    <Stack gap="sm">
      <p data-testid="afford-verdict" data-verdict={data.verdict} className={cx('text-3xl font-semibold leading-tight', VERDICT_TONE[data.verdict])}>
        {headline}
      </p>
      {data.verdict === 'fits' && <p className="text-sm">{t.result.fitsBody}</p>}
      {data.verdict === 'fits' && data.baselineFails && (
        <p role="note" className="rounded-md bg-surface p-md text-sm">
          {t.result.baseline.fits}
        </p>
      )}

      {data.verdict === 'wait' && (
        <>
          {data.baselineFails ? <p className="text-sm">{t.result.baseline.wait}</p> : reason && <p className="text-sm">{reason}</p>}
          {data.waitMonths !== null && <p className="text-sm">{t.result.waitBody(data.waitMonths)}</p>}
        </>
      )}

      {data.verdict === 'no' &&
        (data.baselineFails ? (
          <p className="text-sm">
            {t.result.baseline.no} {reason}
          </p>
        ) : (
          reason && <p className="text-sm">{reason}</p>
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
              <td className={cx('py-sm text-right font-medium', row.deltaMid < 0 ? 'text-negative' : 'text-text')}>
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

/** Verdict, reason, with / without forecast, the 4 horizons and the cheapest way to pay. */
export function AffordResultPanel({ result, rules, invalidFields, purchaseLabel, chosenWay }: AffordResultPanelProps) {
  if (result === null) {
    return (
      <Card title={t.result.title} tone="muted">
        <p className="text-sm text-text-muted">{invalidFields.length > 0 ? t.form.fixFields : t.form.empty}</p>
      </Card>
    );
  }
  if (result.status === 'loading') {
    return (
      <Card title={t.result.title}>
        <Skeleton label={t.result.loading} />
      </Card>
    );
  }
  if (result.status === 'error') {
    return (
      <Card title={t.result.title}>
        <p role="alert" className="text-sm">{errorText(result.error)}</p>
      </Card>
    );
  }

  const data = result.data;
  return (
    <Stack gap="lg" aria-live="polite">
      <Card title={t.result.title}>
        <Verdict data={data} rules={rules} />
      </Card>

      <Card data-testid="afford-chart">
        <SourceLabel source={data.forecastSource} className="mb-sm" />
        <ForecastChart
          title={t.result.chartTitle(purchaseLabel)}
          series={{ label: t.result.chartWith(purchaseLabel), points: data.withPoints }}
          compare={{ label: t.result.chartWithout, points: data.withoutPoints }}
          footnote={t.result.chartFootnote}
        />
      </Card>

      <Card title={t.result.horizonsTitle} data-testid="afford-horizons">
        <SourceLabel source={data.forecastSource} className="mb-sm" />
        <Horizons data={data} />
        <p className="mt-sm text-xs text-text-muted">{t.result.chartFootnote}</p>
      </Card>

      <Card>
        <Stat
          label={t.result.cheapestTitle}
          value={t.result.cheapestWays[data.cheapestWay]}
          hint={`${data.cheapestWay === chosenWay ? t.result.cheapestSame : t.result.cheapestDifferent} ${t.result.cheapestHint}`}
        />
      </Card>
    </Stack>
  );
}
