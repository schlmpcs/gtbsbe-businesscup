'use client';

// S23 Overpaying check (design preview): your monthly costs next to the typical range for your area.
import { useState } from 'react';
import { previewB as c } from '@/copy';
import { Button, Card, EstimateTag, SourceNote, Stack, cx, formatMoney } from '@/ui-kit';
import type { OverpayingLineId, OverpayingRowVM, OverpayingVM } from '../model/types';
import { Pill, Segmented, ToolShell } from './shared';

const t = c.overpaying;
/** Category colors as the app uses them: rent blue, childcare pink, car yellow, food green. */
const DOT: Record<OverpayingLineId, string> = {
  rent: 'bg-chart-1',
  childcare: 'bg-chart-2',
  carInsurance: 'bg-chart-3',
  groceries: 'bg-chart-4',
};
const POSITION_TONE = { below: 'positive', inRange: 'muted', above: 'outline' } as const;
const PLACES = (['0', '1', '2', '3'] as const).map((value, i) => ({ value, label: t.places[i]! }));

export function OverpayingCheck({ vm }: { vm: OverpayingVM }) {
  const [bedrooms, setBedrooms] = useState<(typeof PLACES)[number]['value']>(String(vm.bedrooms) as '1');
  const [zip, setZip] = useState(vm.zip);
  return (
    <ToolShell id="S23" title={t.title} intro={t.intro} note={c.engineNote}>
      <Card>
        <Stack gap="lg">
          <div className="flex flex-wrap items-end gap-md">
            <label className="flex flex-col gap-xs">
              <span className="text-sm text-text-muted">{t.zipLabel}</span>
              <input
                value={zip}
                inputMode="numeric"
                maxLength={5}
                onChange={(e) => setZip(e.target.value)}
                className="w-32 rounded-md border-2 border-border bg-surface px-md py-sm text-lg font-semibold tabular-nums focus:border-ink focus:outline-none"
              />
            </label>
            <p className="pb-sm text-sm text-text-muted">{t.metro(vm.metro)}</p>
          </div>
          <div className="flex flex-col gap-xs">
            <span className="text-sm text-text-muted">{t.placeLegend}</span>
            <Segmented label={t.placeLegend} value={bedrooms} onChange={setBedrooms} options={PLACES} size="md" />
          </div>
          <p className="text-xs text-text-muted">{t.approximate}</p>
        </Stack>
      </Card>

      <Card>
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-md border-b border-border pb-sm text-xs text-text-muted md:grid">
          <span>{t.cols.category}</span>
          <span>{t.cols.yours}</span>
          <span>{t.cols.typical}</span>
          <span>{t.cols.result}</span>
        </div>
        <ul aria-label={t.title} className="flex flex-col divide-y divide-border">
          {vm.rows.map((row) => (
            <Row key={row.line} row={row} />
          ))}
        </ul>
      </Card>

      <Card tone="arena">
        <Stack gap="md">
          <p className="font-display text-3xl font-extrabold leading-tight">{t.summary(formatMoney(vm.summary.gapPerMonth))}</p>
          <p className="text-lg font-semibold">{t.tenYears(formatMoney(vm.summary.effect10y, { signed: true }))}</p>
          <p className="text-base">{t.goalShift(vm.summary.goalWeeks)}</p>
          <Button variant="dark" size="lg" fullWidth>
            {t.addMove}
          </Button>
        </Stack>
      </Card>
      <p className="text-sm text-text-muted">{t.rule}</p>
    </ToolShell>
  );
}

function Row({ row }: { row: OverpayingRowVM }) {
  return (
    <li className="grid grid-cols-2 gap-x-md gap-y-sm py-md md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
      <p className="col-span-2 flex items-center gap-sm font-semibold md:col-span-1">
        <span aria-hidden="true" className={cx('size-sm shrink-0 rounded-full', DOT[row.line])} />
        {t.lines[row.line]}
      </p>
      <div>
        <p className="text-xs text-text-muted md:hidden">{t.cols.yours}</p>
        <p className="font-semibold tabular-nums">
          {formatMoney(row.yours)}
          <span className="text-text-muted">{c.perMonth}</span>
        </p>
      </div>
      <div className="flex flex-col gap-xs">
        <p className="text-xs text-text-muted md:hidden">{t.cols.typical}</p>
        <p className="flex flex-wrap items-center gap-xs tabular-nums">
          {formatMoney(row.low)}–{formatMoney(row.high)}
          {row.isEstimate && <EstimateTag />}
        </p>
        <SourceNote source={row.source} variant="toggle" />
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-xs md:col-span-1 md:flex-col md:items-start">
        <Pill tone={POSITION_TONE[row.position]}>{t.position[row.position]}</Pill>
        {row.position === 'above' && <span className="text-sm font-semibold tabular-nums">{t.gap(formatMoney(row.gapPerMonth))}</span>}
      </div>
    </li>
  );
}
