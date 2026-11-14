// S7 Quick sliders: one slider per spending category plus the retirement share, with this month
// and the 10-year number updating live. Free text can fill the sliders after the user confirms.
import { common, ladder } from '@/copy';
import { Card, formatMoney, formatRate, Row, Slider, Stack, Stat } from '@/ui-kit';
import type { LadderProgressVM, QuickSlidersVM } from '../model/types';
import { DescribeLife } from './DescribeLife';
import { LadderShell } from './LadderShell';

const t = ladder.sliders;

const HINTS: Partial<Record<QuickSlidersVM['sliders'][number]['category'], string>> = {
  rentUtilities: t.rentHint,
  car: t.carHint,
};

export type QuickSlidersProps = { vm: QuickSlidersVM; progress: LadderProgressVM };

export function QuickSliders({ vm, progress }: QuickSlidersProps) {
  const { month, savings } = vm;
  const short = month.surplus < 0;
  return (
    <LadderShell screen="S7" progress={progress} loading={vm.status === 'loading'}>
      <Card title={t.monthTitle}>
        <Stack gap="md">
          <Row gap="xl" align="start">
            <Stat label={t.takeHome} value={formatMoney(month.takeHome.value)} isEstimate={month.takeHome.isEstimate} />
            <Stat label={t.spending} value={formatMoney(month.spending)} />
            <Stat label={t.debtPayments} value={formatMoney(month.debtPayments)} />
            <Stat
              label={short ? t.shortfall : t.surplus}
              value={formatMoney(month.surplus)}
              tone={short ? 'negative' : 'positive'}
            />
          </Row>
          <p className="text-sm" data-testid="month-cost">
            {vm.selfGuess !== null
              ? t.vsGuess(formatMoney(vm.monthlyCost), formatMoney(vm.selfGuess))
              : t.noGuess(formatMoney(vm.monthlyCost))}
          </p>
        </Stack>
      </Card>

      <DescribeLife parse={vm.parse} rows={vm.parsedRows} />

      <Card title={t.slidersTitle} id="sliders">
        <Stack gap="lg" as="ul" aria-label={t.slidersLabel}>
          {vm.sliders.map((s) => (
            <li key={s.category}>
              <Slider
                label={common.categories[s.category]}
                value={s.value}
                min={s.min}
                max={s.max}
                step={s.step}
                isEstimate={s.isEstimate}
                hint={HINTS[s.category]}
                formatValue={(v) => formatMoney(v)}
                onValueChange={(v) => vm.setSpending(s.category, v)}
              />
            </li>
          ))}
          <li>
            <Slider
              label={t.savingsLabel}
              value={savings.value}
              min={savings.min}
              max={savings.max}
              step={savings.step}
              isEstimate={savings.isEstimate}
              hint={t.savingsHint}
              formatValue={(v) => formatRate(v, 0)}
              onValueChange={vm.setSavingsShare}
            />
          </li>
        </Stack>
      </Card>
    </LadderShell>
  );
}
