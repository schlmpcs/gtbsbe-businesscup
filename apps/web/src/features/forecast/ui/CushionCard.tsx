// S1 Home: the emergency cushion card. Months of essentials cash covers with no income, a meter
// against the common 1 / 3 / 6 month guideline, and what the next step takes.
// Presentational: every number comes from TodayVM.cushion (engine emergencyCushion).
import { cushion as t } from '@/copy';
import { cx, EstimateTag, formatMoney, Stack } from '@/ui-kit';
import { formatPlainNumber } from '@/ui-kit/numbers';
import type { CushionVM, TodayVM } from '../model/types';
import { ErrorNote, Skeleton } from './shared';

const CARD = 'rounded-xl bg-surface p-xl shadow-md';
const CARD_TITLE = 'text-xs font-bold uppercase tracking-wide';
const BAND_FILL: Record<CushionVM['band'], string> = {
  under1: 'bg-negative',
  '1to3': 'bg-warning',
  '3to6': 'bg-positive',
  '6plus': 'bg-positive',
};

/** Months to one decimal, rounded down so the cushion is never shown bigger than it is. */
const monthsText = (m: number) => formatPlainNumber(Math.floor(m * 10) / 10, 1, true);

export function CushionCard({ vm }: { vm: TodayVM }) {
  const ready = vm.status === 'ready';
  return (
    <section aria-labelledby="cushion-heading" data-testid="cushion" className={cx(CARD, 'flex flex-col gap-md')}>
      <h2 id="cushion-heading" className={cx(CARD_TITLE, 'text-text-muted')}>
        {t.title}
      </h2>
      {!ready || vm.cushion.status === 'loading' ? (
        <Skeleton lines={3} />
      ) : vm.cushion.status === 'error' ? (
        <ErrorNote error={vm.cushion.error} />
      ) : (
        <Cushion data={vm.cushion.data} />
      )}
    </section>
  );
}

function Cushion({ data }: { data: CushionVM }) {
  if (data.monthsEssential === null) {
    return (
      <Stack gap="sm">
        <p className="text-sm">{t.noEssentials}</p>
        <p className="text-xs text-text-muted">{t.guideline}</p>
      </Stack>
    );
  }
  const months = monthsText(data.monthsEssential);
  return (
    <Stack gap="md">
      <div>
        <p data-testid="cushion-months" className="font-display text-5xl font-extrabold leading-display tabular-nums">
          {t.months(months)}
        </p>
        <p className="mt-xs flex flex-wrap items-center gap-xs text-sm text-text-muted">
          <span>{t.label}</span>
          {data.isEstimate && <EstimateTag />}
        </p>
      </div>
      <Meter months={data.monthsEssential} shown={months} data={data} />
      <p data-testid="cushion-next" className="text-sm font-semibold">
        {data.next ? t.next(formatMoney(data.next.extraCash), data.next.months) : t.top}
      </p>
      {data.monthsFull !== null && <p className="text-xs text-text-muted">{t.full(monthsText(data.monthsFull))}</p>}
      <p className="text-xs text-text-muted">
        {t.essentials} {t.guideline}
      </p>
    </Stack>
  );
}

/** A bar from 0 to the top guideline (6 months), filled to the months covered, with ticks at the band edges. */
function Meter({ months, shown, data }: { months: number; shown: string; data: CushionVM }) {
  const max = data.bands.solid;
  const pct = (m: number) => `${Math.min(Math.max(m / max, 0), 1) * 100}%`;
  const ticks = [0, data.bands.thin, data.bands.okay, data.bands.solid];
  return (
    <div
      role="meter"
      aria-label={t.meterLabel}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(months, max)}
      aria-valuetext={`${t.months(shown)}, ${t.bands[data.band]}`}
      className="flex flex-col gap-xs"
    >
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-bg">
        <div className={cx('h-full rounded-full transition-all duration-500', BAND_FILL[data.band])} style={{ width: pct(months) }} />
        {ticks.slice(1, -1).map((m) => (
          <span key={m} aria-hidden="true" className="absolute top-0 h-full w-px bg-text-muted/40" style={{ left: pct(m) }} />
        ))}
      </div>
      <div aria-hidden="true" className="relative h-4 text-xs text-text-muted tabular-nums">
        {ticks.map((m, i) => (
          <span
            key={m}
            className={cx('absolute', i === 0 ? 'left-0' : i === ticks.length - 1 ? 'right-0' : '-translate-x-1/2')}
            style={i === 0 || i === ticks.length - 1 ? undefined : { left: pct(m) }}
          >
            {i === ticks.length - 1 ? `${m}+` : m}
          </span>
        ))}
      </div>
      <p className="text-xs font-semibold">{t.bands[data.band]}</p>
    </div>
  );
}
