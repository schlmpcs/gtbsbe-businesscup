'use client';

import { useId, type ReactNode } from 'react';
import { cx } from './cx';
import { EstimateTag } from './EstimateTag';
import { clamp, snapToStep } from './numbers';

/** Positions on the track in log mode (each one is 0.5% of the log range; fine enough for a guess). */
export const LOG_SLIDER_POSITIONS = 200;

export type SliderProps = {
  /** Visible label; also the accessible name. */
  label: ReactNode;
  value: number;
  /** Called with the new value (already snapped to `step` and clamped to min/max). */
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  /** Value granularity (default 1). In log mode the value is snapped to it after mapping. */
  step?: number;
  /**
   * linear (default), or log: equal track distance = equal ratio ($1k→$2k is as far as $5k→$10k).
   * Log needs min > 0. Used by the game's guess slider.
   */
  scale?: 'linear' | 'log';
  /** Formats the value label, the min/max labels and the spoken value (default String). */
  formatValue?: (value: number) => string;
  /** Help text under the slider. */
  hint?: ReactNode;
  /** Shows an "estimate" tag next to the label. */
  isEstimate?: boolean;
  /** Hide the min/max labels under the track. */
  hideBounds?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
};

function toPosition(value: number, min: number, max: number, scale: 'linear' | 'log'): number {
  if (scale === 'linear') return value;
  const v = clamp(value, min, max);
  return Math.round(((Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min))) * LOG_SLIDER_POSITIONS);
}

function fromPosition(position: number, min: number, max: number, step: number, scale: 'linear' | 'log'): number {
  const raw =
    scale === 'linear'
      ? position
      : Math.exp(Math.log(min) + (position / LOG_SLIDER_POSITIONS) * (Math.log(max) - Math.log(min)));
  return clamp(snapToStep(raw, step, scale === 'linear' ? min : 0), min, max);
}

/** Map a value to its log-track position and back (exported for tests and for the game's tick marks). */
export const sliderScale = { toPosition, fromPosition };

/** An accessible range input with a visible label, live value and min/max labels. */
export function Slider({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  scale = 'linear',
  formatValue = String,
  hint,
  isEstimate = false,
  hideBounds = false,
  disabled,
  name,
  id,
  className,
}: SliderProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  if (scale === 'log' && !(min > 0)) throw new Error('Slider: scale="log" needs min > 0');

  const isLog = scale === 'log';
  const shown = formatValue(value);

  return (
    <div className={cx('flex flex-col gap-xs', className)}>
      <div className="flex items-baseline justify-between gap-md">
        <div className="flex flex-wrap items-center gap-sm">
          <label htmlFor={inputId} className="text-sm font-medium">
            {label}
          </label>
          {isEstimate && <EstimateTag />}
        </div>
        <output htmlFor={inputId} className="shrink-0 text-base font-semibold tabular-nums">
          {shown}
        </output>
      </div>
      <input
        id={inputId}
        name={name}
        type="range"
        disabled={disabled}
        min={isLog ? 0 : min}
        max={isLog ? LOG_SLIDER_POSITIONS : max}
        step={isLog ? 1 : step}
        value={toPosition(value, min, max, scale)}
        aria-valuetext={shown}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onValueChange(fromPosition(Number(e.target.value), min, max, step, scale))}
        className="w-full cursor-pointer accent-primary py-sm disabled:cursor-not-allowed disabled:opacity-50"
      />
      {!hideBounds && (
        <div aria-hidden="true" className="flex justify-between text-xs text-text-muted tabular-nums">
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
