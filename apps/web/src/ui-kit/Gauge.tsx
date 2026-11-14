import { useId, type ReactNode } from 'react';
import { common } from '@/copy';
import { cx } from './cx';
import { clamp } from './numbers';

export type GaugeZone = 'low' | 'medium' | 'high';

export type GaugeThresholds = {
  /** Values at or above this are in the yellow zone. */
  yellow: number;
  /** Values above this are in the red zone. */
  red: number;
};

export type GaugeProps = {
  /** Visible label; also the meter's accessible name. */
  label: ReactNode;
  value: number;
  /** Zone boundaries, passed in by the caller (e.g. debtLoadThresholds from engine assumptions). */
  thresholds: GaugeThresholds;
  /** Start of the dial (default 0). */
  min?: number;
  /** End of the dial; values beyond it pin the needle at the end. */
  max: number;
  /** Formats the value and the threshold ticks (default String). For rates pass formatRate. */
  formatValue?: (value: number) => string;
  /** Words for the three zones (default Low / Medium / High from copy). */
  zoneLabels?: Partial<Record<GaugeZone, string>>;
  /** Small print under the reading (e.g. what the number means). */
  hint?: ReactNode;
  className?: string;
};

/** Which zone a value falls in: below yellow → low, above red → high, otherwise medium. */
export function gaugeZone(value: number, { yellow, red }: GaugeThresholds): GaugeZone {
  if (value < yellow) return 'low';
  if (value > red) return 'high';
  return 'medium';
}

const ZONE_COLOR: Record<GaugeZone, string> = {
  low: 'var(--color-positive)',
  medium: 'var(--color-warning)',
  high: 'var(--color-negative)',
};
const ZONE_TEXT: Record<GaugeZone, string> = {
  low: 'text-positive',
  medium: 'text-warning',
  high: 'text-negative',
};

// Dial geometry in SVG user units (the SVG scales to its container width).
const CX = 100;
const CY = 100;
const R = 80;
const STROKE = 18;

/** Point on the dial for a 0–1 fraction (0 = left end, 1 = right end, over the top). */
function point(fraction: number, radius = R): [number, number] {
  const angle = Math.PI * (1 - fraction);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function arc(from: number, to: number): string {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
}

/** A semicircular green / yellow / red dial with a needle, e.g. the debt-load gauge. */
export function Gauge({
  label,
  value,
  thresholds,
  min = 0,
  max,
  formatValue = String,
  zoneLabels,
  hint,
  className,
}: GaugeProps) {
  const labelId = useId();
  const span = max - min;
  const frac = (v: number) => (span > 0 ? clamp((v - min) / span, 0, 1) : 0);
  const zone = gaugeZone(value, thresholds);
  const zoneText = { ...common.kit.gaugeZones, ...zoneLabels }[zone];
  const shown = formatValue(value);

  const yellowAt = frac(thresholds.yellow);
  const redAt = frac(thresholds.red);
  const [nx, ny] = point(frac(value), R - STROKE);
  const segments: { zone: GaugeZone; from: number; to: number }[] = [
    { zone: 'low' as const, from: 0, to: yellowAt },
    { zone: 'medium' as const, from: yellowAt, to: redAt },
    { zone: 'high' as const, from: redAt, to: 1 },
  ].filter((s) => s.to > s.from);
  // Tick labels: min and max under the ends of the dial, the two thresholds just outside the arc.
  const ticks = [
    { key: 'min', at: 0, value: min, below: true },
    { key: 'max', at: 1, value: max, below: true },
    { key: 'yellow', at: yellowAt, value: thresholds.yellow, below: false },
    { key: 'red', at: redAt, value: thresholds.red, below: false },
  ].filter((t) => t.below || (t.at > 0 && t.at < 1));

  return (
    <div
      role="meter"
      aria-labelledby={labelId}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamp(value, min, max)}
      aria-valuetext={`${shown}, ${zoneText}`}
      className={cx('flex flex-col items-center gap-xs', className)}
    >
      <span id={labelId} className="self-start text-sm font-medium">
        {label}
      </span>
      <svg viewBox="-16 -16 232 136" aria-hidden="true" className="w-full max-w-(--container-xs)">
        {segments.map((s) => (
          <path key={s.zone} d={arc(s.from, s.to)} fill="none" stroke={ZONE_COLOR[s.zone]} strokeWidth={STROKE} />
        ))}
        <line
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          stroke="var(--color-text)"
          strokeWidth={4}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        <circle cx={CX} cy={CY} r={7} fill="var(--color-text)" />
        {ticks.map((t) => {
          const [x, y] = point(t.at, R + STROKE / 2 + 9);
          const endX = t.at === 0 ? CX - R - STROKE / 2 : CX + R + STROKE / 2;
          return (
            <text
              key={t.key}
              x={t.below ? endX : x}
              y={t.below ? CY + 16 : y}
              textAnchor={t.below ? (t.at === 0 ? 'start' : 'end') : 'middle'}
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--color-text-muted)"
            >
              {formatValue(t.value)}
            </text>
          );
        })}
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-3xl font-semibold leading-tight tabular-nums">{shown}</span>
        <span className={cx('text-sm font-semibold', ZONE_TEXT[zone])}>{zoneText}</span>
      </div>
      {hint && <p className="text-center text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
