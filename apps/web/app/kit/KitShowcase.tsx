'use client';

import { debtLoadThresholds } from '@lifeguessr/engine/assumptions';
import { useState } from 'react';
import { common, kitShowcase as t } from '@/copy';
import {
  BarBreakdown,
  Button,
  Card,
  EstimateTag,
  Field,
  ForecastChart,
  formatMoney,
  formatRate,
  Gauge,
  Money,
  NumberInput,
  Percent,
  Row,
  Sheet,
  Slider,
  SourceNote,
  Stack,
  Stat,
  Tabs,
} from '@/ui-kit';
import {
  areaItems,
  demoArea,
  demoLoanOffers,
  demoProfile,
  profileSpendingItems,
  sampleForecast,
  sampleForecastCompare,
} from './samples';

const money = (n: number) => formatMoney(n);
const rate = (n: number) => formatRate(n);

export function KitShowcase() {
  const [rent, setRent] = useState(demoProfile.spending.rentUtilities.value);
  const [guess, setGuess] = useState(4000);
  const [debtLoad, setDebtLoad] = useState(0.25);
  const [amount, setAmount] = useState<number | null>(demoLoanOffers[0]?.amount ?? null);
  const [apr, setApr] = useState<number | null>(demoLoanOffers[0]?.apr ?? null);
  const [term, setTerm] = useState<number | null>(demoLoanOffers[0]?.termMonths ?? null);
  const [offer, setOffer] = useState('offer-1');
  const [sheetOpen, setSheetOpen] = useState(false);
  const termInvalid = term === null || term < 1 || term > 84;

  return (
    <Stack gap="xl">
      <Card title={t.sections.buttons} data-kit="button">
        <Stack gap="md">
          <Row>
            <Button>{t.buttons.primary}</Button>
            <Button variant="secondary">{t.buttons.secondary}</Button>
            <Button variant="ghost">{t.buttons.ghost}</Button>
          </Row>
          <Row>
            <Button size="sm">{t.buttons.small}</Button>
            <Button size="lg">{t.buttons.large}</Button>
            <Button disabled>{t.buttons.disabled}</Button>
          </Row>
          <Button fullWidth>{t.buttons.full}</Button>
        </Stack>
      </Card>

      <Card title={t.sections.stats} data-kit="stat">
        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
          <Stat
            label={t.stats.takeHome}
            value={<Money value={demoProfile.takeHomePay.value} />}
            isEstimate={demoProfile.takeHomePay.isEstimate}
            hint={t.stats.perMonth}
          />
          <Stat
            label={t.stats.retirement}
            value={<Money value={demoProfile.retirement.value} />}
            isEstimate={demoProfile.retirement.isEstimate}
            hint={t.stats.balance}
          />
          <Stat
            label={t.stats.rent}
            value={<Money value={demoArea.rentByBedrooms[2].value} />}
            source={demoArea.rentByBedrooms[2].source}
            sourceVariant="toggle"
            hint={t.stats.perMonth}
          />
          <Stat
            label={t.stats.apr}
            value={<Percent value={demoProfile.debts[0]?.apr ?? 0} digits={2} />}
            tone="negative"
          />
        </div>
        <Row className="mt-lg">
          <EstimateTag />
          <SourceNote source={demoArea.groceriesPerAdult.source} />
        </Row>
      </Card>

      <Card title={t.sections.sliders} data-kit="slider">
        <Stack gap="xl">
          <Slider
            label={t.sliders.rent}
            value={rent}
            onValueChange={setRent}
            min={0}
            max={5000}
            step={50}
            formatValue={money}
          />
          <Slider
            label={t.sliders.guess}
            value={guess}
            onValueChange={setGuess}
            min={1000}
            max={20000}
            step={50}
            scale="log"
            formatValue={money}
            hint={t.sliders.guessHint}
          />
          <Slider
            label={t.sliders.debtLoad}
            value={debtLoad}
            onValueChange={setDebtLoad}
            min={0}
            max={0.6}
            step={0.01}
            formatValue={rate}
          />
        </Stack>
      </Card>

      <Card title={t.sections.gauge} data-kit="gauge">
        <Gauge
          label={t.gauge.label}
          value={debtLoad}
          thresholds={debtLoadThresholds.value}
          max={0.6}
          formatValue={rate}
          hint={t.gauge.hint}
        />
      </Card>

      <Card title={t.sections.inputs} data-kit="field">
        <Stack gap="lg">
          <Field label={t.inputs.amount}>
            <NumberInput value={amount} onValueChange={setAmount} prefix={t.inputs.dollar} max={1_000_000} />
          </Field>
          <Field label={t.inputs.apr} hint={t.inputs.aprHint} isEstimate>
            <NumberInput value={apr} onValueChange={setApr} percent suffix={t.inputs.percent} max={1} />
          </Field>
          <Field label={t.inputs.term} error={termInvalid ? t.inputs.termError : undefined}>
            <NumberInput value={term} onValueChange={setTerm} suffix={t.inputs.months} maxFractionDigits={0} />
          </Field>
        </Stack>
      </Card>

      <Card title={t.sections.tabs} data-kit="tabs">
        <Tabs
          label={t.tabs.label}
          value={offer}
          onValueChange={setOffer}
          fullWidth
          tabs={demoLoanOffers.map((o, i) => ({
            id: `offer-${i + 1}`,
            label: t.tabs.offer(i + 1),
            panel: (
              <div className="grid grid-cols-2 gap-lg">
                <Stat label={t.tabs.amount} value={<Money value={o.amount} />} />
                <Stat label={t.tabs.apr} value={<Percent value={o.apr} digits={2} />} />
                <Stat label={t.tabs.term} value={t.tabs.termMonths(o.termMonths)} />
                <Stat label={t.tabs.downPayment} value={<Money value={o.downPayment ?? 0} />} />
              </div>
            ),
          }))}
        />
      </Card>

      <Card title={t.sections.sheet} data-kit="sheet">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          {t.sheet.open}
        </Button>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={t.sheet.title}
          description={t.sheet.description}
          footer={
            <Button fullWidth onClick={() => setSheetOpen(false)}>
              {t.sheet.confirm}
            </Button>
          }
        >
          <p className="text-sm">{t.sheet.body}</p>
        </Sheet>
      </Card>

      <Card title={t.sections.chart} data-kit="forecast-chart">
        <ForecastChart
          title={t.chart.title}
          hideTitle
          series={{ label: t.chart.main, points: sampleForecast }}
          compare={sampleForecastCompare && { label: t.chart.compare, points: sampleForecastCompare }}
          footnote={t.chart.footnote}
        />
      </Card>

      <Card title={t.sections.breakdown} data-kit="bar-breakdown">
        <Stack gap="xl">
          <BarBreakdown label={t.breakdown.profile} items={profileSpendingItems} />
          <BarBreakdown label={t.breakdown.area} items={areaItems} />
        </Stack>
      </Card>

      <Card title={t.sections.layout} data-kit="layout">
        <Stack gap="sm">
          <Row gap="md">
            {[t.layout.a, t.layout.b, t.layout.c].map((label) => (
              <span key={label} className="rounded-md bg-surface px-md py-sm text-sm">
                {label}
              </span>
            ))}
          </Row>
          <p className="text-xs text-text-muted">{common.disclaimer}</p>
        </Stack>
      </Card>
    </Stack>
  );
}
