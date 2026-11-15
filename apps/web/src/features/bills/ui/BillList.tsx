// Every bill with its due day, editable inline (a select per bill), and the paydays.
import { bills as t } from '@/copy';
import { cx, EstimateTag, formatMoney, Select, Tag } from '@/ui-kit';
import type { BillVM } from '../model/types';
import { KIND_DOT } from './kind';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export type BillListProps = {
  bills: BillVM[];
  onDueDay: (billId: string, day: number | null) => void;
};

export function BillList({ bills, onDueDay }: BillListProps) {
  return (
    <ul className="flex flex-col divide-y divide-border" data-testid="bills-list">
      {bills.map((b) => (
        <li key={b.id} className="flex flex-wrap items-center justify-between gap-md py-md">
          <div className="flex min-w-0 flex-col gap-xs">
            <span className="flex min-w-0 items-center gap-sm font-bold">
              <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', KIND_DOT[b.kind])} />
              <span className="min-w-0 break-words">{b.label}</span>
            </span>
            <span className="flex flex-wrap items-center gap-xs text-sm text-text-muted">
              <span className="tabular-nums">
                {formatMoney(b.amount)} {t.list.perCadence[b.cadence]}
              </span>
              {b.amountIsEstimate && <EstimateTag />}
              {b.dueDayIsEstimate ? (
                <Tag variant="dashed" title={t.list.assumedDayHint}>
                  {t.list.assumedDay}
                  <span className="sr-only">: {t.list.assumedDayHint}</span>
                </Tag>
              ) : (
                b.kind === 'subscription' && !b.dueDaySetByUser && <Tag>{t.list.fromStatement}</Tag>
              )}
            </span>
          </div>
          <div className="flex items-center gap-sm">
            <Select
              aria-label={t.list.dueDay(b.label)}
              value={b.dueDay}
              onChange={(e) => onDueDay(b.id, Number(e.target.value))}
              fullWidth={false}
              className="tabular-nums"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {t.list.dayOption(d)}
                </option>
              ))}
            </Select>
            {b.dueDaySetByUser && (
              <button type="button" onClick={() => onDueDay(b.id, null)} className="min-h-11 text-sm font-semibold text-primary hover:underline">
                {t.list.reset}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export type PaydaysFormProps = {
  days: number[];
  isEstimate: boolean;
  onChange: (days: number[]) => void;
};

export function PaydaysForm({ days, isEstimate, onChange }: PaydaysFormProps) {
  const first = days[0] ?? 1;
  const second = days[1] ?? 0;
  const set = (a: number, b: number) => onChange(b > 0 && b !== a ? [a, b] : [a]);
  return (
    <fieldset className="flex flex-col gap-sm">
      <legend className="mb-xs text-sm font-bold">{t.payday.settingsTitle}</legend>
      <div className="flex flex-wrap gap-md">
        <label className="flex flex-col gap-xs text-sm">
          {t.payday.first}
          <Select value={first} onChange={(e) => set(Number(e.target.value), second)} fullWidth={false} className="tabular-nums">
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {t.list.dayOption(d)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-xs text-sm">
          {t.payday.second}
          <Select value={second} onChange={(e) => set(first, Number(e.target.value))} fullWidth={false} className="tabular-nums">
            <option value={0}>{t.payday.noSecond}</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {t.list.dayOption(d)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {isEstimate && (
        <p className="flex items-center gap-xs text-xs text-text-muted">
          <EstimateTag />
          {t.payday.assumed}
        </p>
      )}
    </fieldset>
  );
}
