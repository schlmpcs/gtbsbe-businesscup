'use client';

// S25 Runway (design preview): months of essentials your cash covers, and what closes the gap.
import { useState } from 'react';
import { previewB as c } from '@/copy';
import { Button, Card, Stack, Tag, cx, formatMoney } from '@/ui-kit';
import type { RunwayVM } from '../model/types';
import { Pill, Segmented, ToolShell } from './shared';

const t = c.runway;

export function Runway({ vm }: { vm: RunwayVM }) {
  const [horizon, setHorizon] = useState(String(vm.close.options[1]?.months ?? vm.close.options[0]!.months));
  const chosen = vm.close.options.find((o) => String(o.months) === horizon) ?? vm.close.options[0]!;
  return (
    <ToolShell id="S25" title={t.title} intro={t.intro}>
      <Card>
        <dl className="grid grid-cols-2 gap-lg">
          <div>
            <dt className="text-sm text-text-muted">{t.cash}</dt>
            <dd className="font-display text-3xl font-extrabold tabular-nums">{formatMoney(vm.cash)}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">{t.essentials}</dt>
            <dd className="font-display text-3xl font-extrabold tabular-nums">{formatMoney(vm.essentials)}</dd>
          </div>
        </dl>
        <div className="mt-md flex items-center justify-between gap-md">
          <p className="text-xs text-text-muted">{t.essentialsHint}</p>
          <Button variant="secondary" size="sm">
            {t.edit}
          </Button>
        </div>
      </Card>

      <Card tone="default">
        <Stack gap="md">
          <p className="text-sm text-text-muted">{t.coverLabel}</p>
          <p className="font-display text-display leading-display font-extrabold tabular-nums">{vm.months.toFixed(1)}
            <span className="text-2xl text-text-muted"> {t.monthsUnit}</span>
          </p>
          <RunwayMeter fill={vm.fill} marks={vm.marks} />
        </Stack>
      </Card>

      <Card title={t.targetsHeading} action={<Tag variant="dashed">{t.ruleTag}</Tag>}>
        <ul className="flex flex-col divide-y divide-border">
          {vm.targets.map((x) => (
            <li key={x.months} className="flex items-center justify-between gap-md py-md">
              <div>
                <p className="font-semibold">{t.target(x.months)}</p>
                <p className="text-sm text-text-muted tabular-nums">{formatMoney(x.need)}</p>
              </div>
              {x.shortfall > 0 ? <Pill tone="outline">{t.shortfall(formatMoney(x.shortfall))}</Pill> : <Pill tone="positive">{t.reached}</Pill>}
            </li>
          ))}
        </ul>
      </Card>

      <Card tone="arena" title={t.closeHeading}>
        <Stack gap="md">
          <Segmented label={t.timeLegend} value={horizon} onChange={setHorizon} options={vm.close.options.map((o) => ({ value: String(o.months), label: t.horizon(o.months) }))} tone="arena" />
          <p className="font-display text-2xl font-extrabold leading-tight">{t.closeLine(formatMoney(chosen.perMonth), chosen.months, vm.close.target)}</p>
          <Button variant="dark" size="lg" fullWidth>
            {t.addMove}
          </Button>
        </Stack>
      </Card>
      <p className="text-sm text-text-muted">{t.note}</p>
    </ToolShell>
  );
}

/** A horizontal meter with tick marks at the rule-of-thumb targets. Neutral, never red. */
function RunwayMeter({ fill, marks }: { fill: number; marks: RunwayVM['marks'] }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-xs pt-md">
      <div className="relative h-lg w-full rounded-full bg-surface-strong">
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${fill * 100}%` }} />
        {marks.map((m) => (
          <span key={m.months} className="absolute -inset-y-xs w-[2px] bg-ink" style={{ left: `${m.at * 100}%` }} />
        ))}
      </div>
      <div className="relative h-lg text-xs text-text-muted">
        <span className="absolute left-0">0</span>
        {marks.map((m) => (
          <span key={m.months} className={cx('absolute', m.at >= 1 ? '-translate-x-full' : '-translate-x-1/2')} style={{ left: `${m.at * 100}%` }}>
            {m.months}
          </span>
        ))}
      </div>
    </div>
  );
}
