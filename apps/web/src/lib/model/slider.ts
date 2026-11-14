// Slider math for view-models: linear and log-scale tracks, snapping to a step. The UI only
// renders `position` and reports a new position or value back.
import type { SliderVM } from './types';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Round to the nearest multiple of `step`, then clamp to [min, max]. */
export function snap(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  const snapped = step > 0 ? Math.round(value / step) * step : value;
  return clamp(snapped, min, max);
}

/** A log-scale track from min to max (both > 0): equal distances = equal ratios. */
export function logScale(min: number, max: number) {
  const lnMin = Math.log(min);
  const span = Math.log(max) - lnMin;
  return {
    toPosition: (value: number) => (value > 0 ? clamp((Math.log(value) - lnMin) / span, 0, 1) : 0),
    fromPosition: (position: number) => Math.exp(lnMin + clamp(position, 0, 1) * span),
  };
}

/** SliderVM for a log-scale track. */
export function logSliderVM(value: number, min: number, max: number, step: number): SliderVM {
  return { value, min, max, step, position: logScale(min, max).toPosition(value) };
}

/** SliderVM for a linear track. */
export function linearSliderVM(value: number, min: number, max: number, step: number): SliderVM {
  return { value, min, max, step, position: max > min ? clamp((value - min) / (max - min), 0, 1) : 0 };
}
