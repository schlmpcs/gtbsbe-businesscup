'use client';

import { afford as t } from '@/copy';
import { Art, Card, cx, ForecastChart, formatRate, Money, Scoreboard, Stack, Sticker } from '@/ui-kit';
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

const STICKER_TONE = { fits: 'positive', wait: 'primary', no: 'primary' } as const;

/** Headline verdict plus the plain-language reason; never blames the purchase for a plan that already breaks a rule. */
function Verdict({ data, rules }: { data: AffordResultVM; rules: AffordRulesVM }) {
  const headline =
    data.verdict === 'fits'
      ? t.result.verdicts.fits
      : data.verdict === 'wait'
        ? t.result.verdicts.wait(data.waitMonths ?? 0)
        : t.result.verdicts.no;
  const reason = data.failsOn ? failsOnText(data.failsOn, rules) : null;
  const body = 'text-lg text-text-muted';

  return (
    <Stack gap="md">
      <p
        data-testid="afford-verdict"
        data-verdict={data.verdict}
        className={cx('font-display text-4xl font-extrabold leading-display sm:text-display', VERDICT_TONE[data.verdict])}
      >
        {headline}
      </p>
      {data.verdict === 'fits' && <p className={body}>{t.result.fitsBody}</p>}
      {data.verdict === 'fits' && data.baselineFails && (
        <p role="note" className="rounded-lg bg-surface-strong p-md text-sm">
          {t.result.baseline.fits}
        </p>
      )}

      {data.verdict === 'wait' && (
        <>
          {data.baselineFails ? <p className={body}>{t.result.baseline.wait}</p> : reason && <p className={body}>{reason}</p>}
          {data.waitMonths !== null && <p className={body}>{t.result.waitBody(data.waitMonths)}</p>}
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

/** The green "cheapest way" strip at the bottom of the verdict tile. */
function Cheapest({ data, chosenWay }: { data: AffordResultVM; chosenWay: PayWithChoice }) {
  return (
    <div className="flex flex-col gap-xs rounded-lg bg-positive-soft px-lg py-md">
      <p className="flex flex-wrap gap-x-sm font-semibold text-positive">
        <span>{t.result.cheapestTitle}</span>
        <span aria-hidden="true">·</span>
        <span>{t.result.cheapestWays[data.cheapestWay]}</span>
      </p>
      <p className="text-xs text-text-muted">
        {data.cheapestWay === chosenWay ? t.result.cheapestSame : t.result.cheapestDifferent} {t.result.cheapestHint}
      </p>
    </div>
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

/** The verdict tile (Figma S11, right): sticker, illustration, huge verdict, reason and the cheapest way. */
export function AffordVerdictTile({ result, rules, invalidFields, chosenWay }: Omit<AffordResultPanelProps, 'purchaseLabel'>) {
  if (result === null) {
    return (
      <Card title={t.result.title} tone="muted">
        <Art name="afford" className="mb-lg w-full max-w-(--container-3xs)" />
        <p className="text-lg text-text-muted">{invalidFields.length > 0 ? t.form.fixFields : t.form.empty}</p>
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
    <div className="relative pt-lg" aria-live="polite">
      <Card as="section" aria-label={t.result.title} className="relative flex flex-col gap-lg" style={{ transform: 'rotate(1deg)' }}>
        <Sticker tone={STICKER_TONE[data.verdict]} tilt={-5} className="absolute -top-lg right-xl px-lg py-sm text-base">
          {t.result.sticker[data.verdict]}
        </Sticker>
        <Art name="afford" className="w-1/2 max-w-(--container-3xs)" tilt={-2} />
        <Verdict data={data} rules={rules} />
        <Cheapest data={data} chosenWay={chosenWay} />
      </Card>
    </div>
  );
}

/** The black score bar (net worth change at 4 horizons), the with / without chart and the table behind it. */
export function AffordEffects({ result, purchaseLabel }: Pick<AffordResultPanelProps, 'result' | 'purchaseLabel'>) {
  if (result?.status !== 'ready') return null;
  const data = result.data;
  return (
    <Stack gap="lg">
      {data.horizons.length > 0 && (
        <div className="flex flex-col gap-sm">
          <Scoreboard
            label={t.result.effectsLabel}
            items={data.horizons.map((h, i) => ({
              id: String(h.month),
              value: <Money value={h.deltaMid} signed />,
              label: t.result.effects[h.month],
              tone: h.deltaMid > 0 ? 'positive' : i === 0 ? 'primary' : 'default',
            }))}
          />
          <p className="text-xs text-text-muted">{t.result.effectsNote}</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-lg lg:grid-cols-[3fr_2fr]">
        <Card>
          <ForecastChart
            title={t.result.chartTitle(purchaseLabel)}
            series={{ label: t.result.chartWith(purchaseLabel), points: data.withPoints }}
            compare={{ label: t.result.chartWithout, points: data.withoutPoints }}
            footnote={t.result.chartFootnote}
          />
        </Card>
        <Card title={t.result.horizonsTitle}>
          <Horizons data={data} />
          <p className="mt-sm text-xs text-text-muted">{t.result.chartFootnote}</p>
        </Card>
      </div>
    </Stack>
  );
}

/** Verdict tile plus the effects, stacked (the screen places the two parts separately). */
export function AffordResultPanel(props: AffordResultPanelProps) {
  return (
    <Stack gap="lg">
      <AffordVerdictTile {...props} />
      <AffordEffects result={props.result} purchaseLabel={props.purchaseLabel} />
    </Stack>
  );
}
