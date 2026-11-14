'use client';

// S22 Household (design preview only): members, shared costs entered once, and an income-based split.
import { useState } from 'react';
import { previewB as c } from '@/copy';
import { Button, Card, Stack, cx, formatMoney, formatRate } from '@/ui-kit';
import type { HouseholdGroup, HouseholdVM } from '../model/types';
import { Pill, RowList, Segmented, ToolShell } from './shared';

const t = c.household;
const DOT: Record<HouseholdGroup, string> = {
  housing: 'bg-chart-1',
  childcare: 'bg-chart-2',
  car: 'bg-chart-3',
  groceries: 'bg-chart-4',
  eatingOut: 'bg-chart-4/60',
  subscriptions: 'bg-chart-6',
};
const SPLIT = t.splitOptions.map((label, i) => ({ value: String(i), label }));

export function Household({ vm }: { vm: HouseholdVM }) {
  const [shared, setShared] = useState(() => Object.fromEntries(vm.shared.map((s) => [s.group, s.shared])));
  const [split, setSplit] = useState('0');
  return (
    <ToolShell id="S22" title={t.title} intro={t.intro} aside={<Pill tone="ink">{t.previewTag}</Pill>}>
      <Card title={t.membersHeading}>
        <Stack gap="md">
          <ul className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            {vm.adults.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-md rounded-lg bg-surface-strong p-md">
                <div>
                  <p className="font-semibold">{a.role === 'you' ? t.you : t.partner}</p>
                  <p className="text-xs text-text-muted">{t.adult}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted">{t.income}</p>
                  <p className="font-semibold tabular-nums">
                    {formatMoney(a.income)}
                    <span className="text-text-muted">{c.perMonth}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap gap-sm">
            {vm.kids.map((k) => (
              <li key={k.id}>
                <Pill tone="primary">
                  {t.kidAge(t.ageBands[k.band])}
                </Pill>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-sm">
            <Button variant="secondary" size="sm">
              {t.addAdult}
            </Button>
            <Button variant="secondary" size="sm">
              {t.addKid}
            </Button>
          </div>
        </Stack>
      </Card>

      <Card title={t.sharedHeading}>
        <p className="mb-sm text-sm text-text-muted">{t.sharedHint}</p>
        <RowList label={t.sharedHeading}>
          {vm.shared.map((s) => (
            <li key={s.group} className="flex items-center justify-between gap-md py-md">
              <div className="flex min-w-0 items-center gap-sm">
                <span aria-hidden="true" className={cx('size-sm shrink-0 rounded-full', DOT[s.group])} />
                <div className="min-w-0">
                  <p className="font-semibold">{t.groups[s.group]}</p>
                  <p className="text-sm text-text-muted tabular-nums">
                    {formatMoney(s.amount)}
                    {c.perMonth}
                  </p>
                </div>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-sm text-sm">
                <span className="hidden sm:inline">{t.shareToggle}</span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={`${t.shareToggle}: ${t.groups[s.group]}`}
                  checked={shared[s.group] ?? false}
                  onChange={(e) => setShared((all) => ({ ...all, [s.group]: e.target.checked }))}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative h-xl w-12 rounded-full bg-surface-strong ring-1 ring-border transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:top-1 after:left-1 after:size-4 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform peer-checked:after:translate-x-6"
                />
              </label>
            </li>
          ))}
        </RowList>
      </Card>

      <Card tone="arena" title={t.splitHeading}>
        <Stack gap="md">
          <Segmented label={t.splitLegend} value={split} onChange={setSplit} options={SPLIT} tone="arena" />
          <ul className="flex flex-col gap-sm">
            {vm.split.map((p) => (
              <li key={p.id} className="font-display text-2xl font-extrabold leading-tight">
                {t.pays[p.role](formatMoney(p.amount), formatRate(p.share, 0))}
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="flex h-md w-full overflow-hidden rounded-full bg-surface/30">
            {vm.split.map((p, i) => (
              <span key={p.id} className={cx('h-full', i === 0 ? 'bg-ink' : 'bg-surface')} style={{ width: `${p.share * 100}%` }} />
            ))}
          </div>
          <Button variant="dark" size="lg" fullWidth>
            {t.save}
          </Button>
        </Stack>
      </Card>
      <p className="text-xs text-text-muted">{t.note}</p>
    </ToolShell>
  );
}
