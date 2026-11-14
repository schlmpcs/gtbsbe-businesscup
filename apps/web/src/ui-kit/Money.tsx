import { cx } from './cx';
import { formatMoney, formatRate, type FormatMoneyOptions } from './format';

export type MoneyProps = FormatMoneyOptions & {
  /** Unrounded US dollars (rounded here, at display time). */
  value: number;
  className?: string;
};

/** A dollar amount: <Money value={1234.5} /> → "$1,235". Tabular digits so columns line up. */
export function Money({ value, className, ...opts }: MoneyProps) {
  return <span className={cx('tabular-nums', className)}>{formatMoney(value, opts)}</span>;
}

export type PercentProps = {
  /** A decimal rate (0.228 = 22.8%). Never pass a percent number. */
  value: number;
  /** Maximum fraction digits (default 1). */
  digits?: number;
  className?: string;
};

/** A decimal rate shown as a percent: <Percent value={0.228} /> → "22.8%". */
export function Percent({ value, digits, className }: PercentProps) {
  return <span className={cx('tabular-nums', className)}>{formatRate(value, digits)}</span>;
}
